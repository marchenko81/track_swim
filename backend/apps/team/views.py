import hashlib
import secrets
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.users.models import User
from apps.users.tasks import send_expo_push
from .models import CoachAthleteRelationship
from .serializers import CoachAthleteRelationshipSerializer

FREE_TIER_ATHLETE_LIMIT = 5


def _get_app_domain():
    import os
    return os.environ.get('APP_DOMAIN', 'http://localhost:5173')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_athletes(request):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can access this endpoint.'}, status=403)

    rels = (
        CoachAthleteRelationship.objects.filter(coach=request.user)
        .select_related('athlete')
        .order_by('-created_at')
    )
    serializer = CoachAthleteRelationshipSerializer(rels, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_athlete(request):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can invite athletes.'}, status=403)

    active_count = CoachAthleteRelationship.objects.filter(
        coach=request.user,
        status__in=[CoachAthleteRelationship.Status.ACTIVE, CoachAthleteRelationship.Status.PENDING],
    ).count()
    if active_count >= FREE_TIER_ATHLETE_LIMIT:
        return Response(
            {
                'error': 'You have reached the free tier limit of 5 athletes. Upgrade to invite more.',
                'code': 'tier_limit',
            },
            status=402,
        )

    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=400)

    # Check if this email belongs to an existing user
    try:
        athlete_user = User.objects.get(email=email)

        existing = CoachAthleteRelationship.objects.filter(
            coach=request.user,
            athlete=athlete_user,
        ).exclude(status=CoachAthleteRelationship.Status.REMOVED).first()
        if existing:
            return Response({'error': 'This email is already on your roster.'}, status=400)

        if athlete_user.role != 'athlete':
            return Response({'error': 'This user is registered as a coach, not an athlete.'}, status=400)

        rel = CoachAthleteRelationship.objects.create(
            coach=request.user,
            athlete=athlete_user,
            invite_email=email,
            status=CoachAthleteRelationship.Status.ACTIVE,
            invited_at=timezone.now(),
            accepted_at=timezone.now(),
        )
        serializer = CoachAthleteRelationshipSerializer(rel)
        return Response({'message': f'Athlete {email} linked successfully.', 'auto_linked': True, 'relationship': serializer.data})

    except User.DoesNotExist:
        pass

    # No account — check for existing pending invite
    existing_invite = CoachAthleteRelationship.objects.filter(
        coach=request.user,
        invite_email=email,
        status=CoachAthleteRelationship.Status.PENDING,
    ).first()
    if existing_invite:
        return Response({'error': 'This email is already on your roster.'}, status=400)

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    rel = CoachAthleteRelationship.objects.create(
        coach=request.user,
        invite_email=email,
        invite_token_hash=token_hash,
        status=CoachAthleteRelationship.Status.PENDING,
        invited_at=timezone.now(),
    )

    try:
        _send_invite_email(coach=request.user, invite_email=email, token=raw_token)
    except Exception:
        pass

    serializer = CoachAthleteRelationshipSerializer(rel)
    return Response({'message': f'Invite sent to {email}.', 'relationship': serializer.data})


def _send_invite_email(coach, invite_email, token):
    import os
    import requests as req_lib
    from django.conf import settings

    api_key = getattr(settings, 'SENDGRID_API_KEY', '')
    if not api_key:
        return

    invite_url = f'{_get_app_domain()}/invite/{token}'
    coach_name = f'{coach.first_name} {coach.last_name}'.strip() or coach.email
    club_info = f' from {coach.club_name}' if coach.club_name else ''

    subject = f'Coach {coach_name} invited you to SwimCoach'
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <div style="background:#0ea5e9;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;">SwimCoach</h1>
      </div>
      <div style="padding:32px;color:#374151;line-height:1.6;">
        <h2>You've been invited!</h2>
        <p>Coach <strong>{coach_name}{club_info}</strong> has invited you to join their team on
        <strong>SwimCoach</strong>.</p>
        <a href="{invite_url}" style="background:#0ea5e9;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:8px;font-weight:600;">
          Accept Invitation
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">Or copy: {invite_url}</p>
      </div>
    </div>
    """

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@swimcoach.app')
    req_lib.post(
        'https://api.sendgrid.com/v3/mail/send',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'personalizations': [{'to': [{'email': invite_email}]}],
            'from': {'email': from_email, 'name': 'SwimCoach'},
            'subject': subject,
            'content': [{'type': 'text/html', 'value': html}],
        },
        timeout=10,
    )


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_invite(request, token):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        rel = CoachAthleteRelationship.objects.select_related('coach').get(
            invite_token_hash=token_hash,
            status=CoachAthleteRelationship.Status.PENDING,
        )
        if rel.invited_at and (timezone.now() - rel.invited_at).days > 7:
            return Response({'error': 'This invite has expired.'}, status=410)
        return Response({
            'coach_name': f'{rel.coach.first_name} {rel.coach.last_name}'.strip() or rel.coach.email,
            'club_name': rel.coach.club_name or '',
            'invite_email': rel.invite_email,
        })
    except CoachAthleteRelationship.DoesNotExist:
        return Response({'error': 'Invalid or expired invite.'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invite(request, token):
    if request.user.role != 'athlete':
        return Response({'error': 'Only athletes can accept invites.'}, status=403)

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        rel = CoachAthleteRelationship.objects.get(
            invite_token_hash=token_hash,
            status=CoachAthleteRelationship.Status.PENDING,
        )
        if rel.invited_at and (timezone.now() - rel.invited_at).days > 7:
            return Response({'error': 'This invite has expired.'}, status=410)

        if CoachAthleteRelationship.objects.filter(
            coach=rel.coach, athlete=request.user
        ).exclude(status=CoachAthleteRelationship.Status.REMOVED).exists():
            return Response({'error': "You're already in this coach's roster."}, status=400)

        rel.athlete = request.user
        rel.status = CoachAthleteRelationship.Status.ACTIVE
        rel.accepted_at = timezone.now()
        rel.invite_token_hash = None
        rel.save()
        if rel.coach.expo_push_token:
            athlete_name = f'{request.user.first_name} {request.user.last_name}'.strip() or request.user.email
            send_expo_push.delay(
                rel.coach.expo_push_token,
                'Athlete joined',
                f'{athlete_name} accepted your invite',
                {'route': '/team'},
            )
        return Response({'message': 'Invite accepted successfully.'})
    except CoachAthleteRelationship.DoesNotExist:
        return Response({'error': 'Invalid or expired invite.'}, status=404)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_athlete(request, pk):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can manage athletes.'}, status=403)

    try:
        rel = CoachAthleteRelationship.objects.get(id=pk, coach=request.user)
    except CoachAthleteRelationship.DoesNotExist:
        return Response({'error': 'Relationship not found.'}, status=404)

    new_status = request.data.get('status')
    valid = [
        CoachAthleteRelationship.Status.ACTIVE,
        CoachAthleteRelationship.Status.PAUSED,
        CoachAthleteRelationship.Status.REMOVED,
    ]
    if new_status and new_status in valid:
        rel.status = new_status
        rel.save()
        return Response({'message': 'Status updated.'})

    return Response({'error': 'Invalid status.'}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_coach(request):
    if request.user.role != 'athlete':
        return Response({'error': 'Only athletes can access this endpoint.'}, status=403)

    rels = CoachAthleteRelationship.objects.filter(
        athlete=request.user,
        status=CoachAthleteRelationship.Status.ACTIVE,
    ).select_related('coach')

    coaches = [
        {
            'id': str(rel.id),
            'coach_name': f'{rel.coach.first_name} {rel.coach.last_name}'.strip() or rel.coach.email,
            'club_name': rel.coach.club_name or '',
            'avatar_url': rel.coach.avatar_url,
        }
        for rel in rels
    ]
    return Response({'coaches': coaches})
