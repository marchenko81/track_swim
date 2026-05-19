import hashlib
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User
from .serializers import UserProfileSerializer


def _issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserProfileSerializer(user).data,
    }


def _accept_invite_token(user, raw_token):
    """Accept a pending invite by raw token string. Silently ignores errors."""
    if not raw_token:
        return
    try:
        from apps.team.models import CoachAthleteRelationship
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        rel = CoachAthleteRelationship.objects.get(
            invite_token_hash=token_hash,
            status=CoachAthleteRelationship.Status.PENDING,
        )
        if rel.invited_at and (timezone.now() - rel.invited_at).days > 7:
            return
        # Avoid duplicate if already linked
        if CoachAthleteRelationship.objects.filter(
            coach=rel.coach, athlete=user
        ).exclude(status=CoachAthleteRelationship.Status.REMOVED).exists():
            return
        rel.athlete = user
        rel.status = CoachAthleteRelationship.Status.ACTIVE
        rel.accepted_at = timezone.now()
        rel.invite_token_hash = None
        rel.save()
    except Exception:
        pass


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    role = request.data.get('role', '')

    if not all([email, password, first_name, last_name, role]):
        return Response({'error': 'All fields are required.'}, status=400)
    if role not in ['coach', 'athlete']:
        return Response({'error': 'Role must be coach or athlete.'}, status=400)
    if len(password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({'error': 'An account with this email already exists.'}, status=400)

    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role=role,
    )

    # Send welcome email — silently skip if SendGrid not configured
    try:
        from .email_utils import send_welcome_email
        send_welcome_email(user)
    except Exception:
        pass

    _accept_invite_token(user, request.data.get('invite_token'))

    return Response(_issue_tokens(user), status=201)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not email or not password:
        return Response({'error': 'Email and password are required.'}, status=400)

    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'Invalid credentials.'}, status=401)

    user = authenticate(request, username=user_obj.username, password=password)
    if not user:
        return Response({'error': 'Invalid credentials.'}, status=401)
    if not user.is_active:
        return Response({'error': 'Account is disabled.'}, status=401)

    _accept_invite_token(user, request.data.get('invite_token'))

    return Response(_issue_tokens(user))


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def token_refresh(request):
    raw_token = request.data.get('refresh')
    if not raw_token:
        return Response({'error': 'Refresh token required.'}, status=400)
    try:
        token = RefreshToken(raw_token)
        return Response({
            'access': str(token.access_token),
            'refresh': str(token),
        })
    except TokenError:
        return Response({'error': 'Invalid or expired refresh token.'}, status=401)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        RefreshToken(request.data.get('refresh')).blacklist()
    except Exception:
        pass
    return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    old_password = request.data.get('old_password', '')
    new_password = request.data.get('new_password', '')

    if not old_password or not new_password:
        return Response({'error': 'Both passwords are required.'}, status=400)
    if not request.user.check_password(old_password):
        return Response({'error': 'Current password is incorrect.'}, status=400)
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=400)

    request.user.set_password(new_password)
    request.user.save()
    return Response({'message': 'Password changed successfully.'})


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    if request.method == 'GET':
        return Response(UserProfileSerializer(request.user).data)

    serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)
