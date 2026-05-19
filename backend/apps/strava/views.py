"""
Strava OAuth and sync views.

IMPORTANT: strava_webhook MUST be a plain Django view with @csrf_exempt.
It must respond HTTP 200 within 2 seconds — all processing is done async.
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import requests
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.plans.models import WorkoutLog
from apps.team.models import CoachAthleteRelationship

from .models import StravaSync
from .serializers import StravaActivitySerializer

logger = logging.getLogger(__name__)

STRAVA_SWIM_TYPES = {'Swim', 'OpenWaterSwim'}


def _get_redirect_uri(request):
    return request.build_absolute_uri('/api/strava/callback/')


class StravaAuthUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'athlete':
            return Response({'error': 'Only athletes can connect Strava'}, status=403)

        client_id = getattr(settings, 'STRAVA_CLIENT_ID', '')
        if not client_id:
            return Response({'error': 'Strava integration not configured'}, status=503)

        redirect_uri = _get_redirect_uri(request)
        state = str(request.user.id)

        auth_url = (
            f'https://www.strava.com/oauth/authorize'
            f'?client_id={client_id}'
            f'&redirect_uri={redirect_uri}'
            f'&response_type=code'
            f'&scope=activity:read_all'
            f'&approval_prompt=auto'
            f'&state={state}'
        )
        return Response({'auth_url': auth_url})


class StravaCallbackView(APIView):
    """
    Public endpoint — Strava redirects here after OAuth authorization.
    Returns HTML that posts a message to the opener window and closes.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        error = request.GET.get('error')
        if error:
            return HttpResponse(self._error_html(f'Strava authorization failed: {error}'))

        code = request.GET.get('code')
        state = request.GET.get('state')  # user_id passed via state param
        scope = request.GET.get('scope', '')

        if not code or not state:
            return HttpResponse(self._error_html('Missing code or state parameter'))

        # Resolve user from state
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            athlete = User.objects.get(id=state)
        except (ValueError, Exception):
            return HttpResponse(self._error_html('Invalid state parameter'))

        # Exchange code for tokens
        try:
            response = requests.post('https://www.strava.com/oauth/token', data={
                'client_id': settings.STRAVA_CLIENT_ID,
                'client_secret': settings.STRAVA_CLIENT_SECRET,
                'code': code,
                'grant_type': 'authorization_code',
            }, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error('Strava token exchange failed: %s', e)
            return HttpResponse(self._error_html('Token exchange failed'))

        if 'access_token' not in data:
            return HttpResponse(self._error_html('No access token in response'))

        # Encrypt and store tokens
        from .encryption import encrypt_token
        expires_at = datetime.fromtimestamp(data['expires_at'], tz=timezone.utc)
        strava_athlete_id = data.get('athlete', {}).get('id')

        StravaSync.objects.update_or_create(
            athlete=athlete,
            defaults={
                'strava_athlete_id': strava_athlete_id,
                'access_token': encrypt_token(data['access_token']),
                'refresh_token': encrypt_token(data['refresh_token']),
                'token_expires_at': expires_at,
                'scope': scope,
                'sync_status': 'idle',
                'last_error': None,
            }
        )

        return HttpResponse(self._success_html())

    def _success_html(self):
        return """<!DOCTYPE html>
<html><head><title>Strava Connected</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({type: 'strava_connected'}, '*');
  }
  window.close();
</script>
<p>Strava connected! You can close this window.</p>
</body></html>"""

    def _error_html(self, message):
        return f"""<!DOCTYPE html>
<html><head><title>Strava Error</title></head>
<body>
<script>
  if (window.opener) {{
    window.opener.postMessage({{type: 'strava_error', message: '{message}'}}, '*');
  }}
  window.close();
</script>
<p>Error: {message}. You can close this window.</p>
</body></html>"""


class StravaStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sync = StravaSync.objects.get(athlete=request.user)
        except StravaSync.DoesNotExist:
            return Response({'connected': False})

        activity_count = WorkoutLog.objects.filter(
            athlete=request.user,
            source='strava',
        ).count()

        return Response({
            'connected': True,
            'strava_athlete_id': sync.strava_athlete_id,
            'last_synced_at': sync.last_synced_at.isoformat() if sync.last_synced_at else None,
            'sync_status': sync.sync_status,
            'last_error': sync.last_error,
            'activity_count': activity_count,
        })


class StravaSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != 'athlete':
            return Response({'error': 'Only athletes can sync Strava'}, status=403)

        try:
            StravaSync.objects.get(athlete=request.user)
        except StravaSync.DoesNotExist:
            return Response({'error': 'Strava not connected'}, status=400)

        # Check cooldown via Redis
        redis_key = f'strava:sync_cooldown:{request.user.id}'
        try:
            import redis
            r = redis.from_url(settings.CELERY_BROKER_URL)
            ttl = r.ttl(redis_key)
            if ttl > 0:
                return Response(
                    {'error': 'Sync cooldown active', 'seconds_remaining': ttl},
                    status=429
                )
            r.set(redis_key, 1, ex=900)
        except Exception as e:
            logger.warning('Redis unavailable for sync cooldown check: %s', e)

        # Enqueue backfill task
        from .tasks import backfill_strava_activities
        backfill_strava_activities.apply_async(
            args=[str(request.user.id)],
            kwargs={'days': 30},
            queue='strava_sync',
        )

        return Response({'status': 'syncing', 'message': 'Sync started'})


class StravaDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        try:
            sync = StravaSync.objects.get(athlete=request.user)
        except StravaSync.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        # Best-effort token revocation
        try:
            from .encryption import decrypt_token
            requests.post(
                'https://www.strava.com/oauth/deauthorize',
                data={'access_token': decrypt_token(sync.access_token)},
                timeout=5,
            )
        except Exception as e:
            logger.warning('Strava token revocation failed (non-fatal): %s', e)

        sync.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StravaActivitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = WorkoutLog.objects.filter(
            athlete=request.user,
            source__in=['strava', 'strava_deleted'],
        ).select_related('session').prefetch_related('set_logs', 'metric_snapshots').order_by('-logged_date')

        paginator = PageNumberPagination()
        paginator.page_size = int(request.GET.get('page_size', 20))
        page = paginator.paginate_queryset(qs, request)
        serializer = StravaActivitySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class StravaActivityDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, workout_log_id):
        try:
            log = WorkoutLog.objects.select_related('session', 'athlete').prefetch_related(
                'set_logs', 'metric_snapshots'
            ).get(id=workout_log_id)
        except WorkoutLog.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if request.user.role == 'athlete':
            if log.athlete_id != request.user.id:
                return Response({'error': 'Not found'}, status=404)
        elif request.user.role == 'coach':
            if not CoachAthleteRelationship.objects.filter(
                coach=request.user,
                athlete=log.athlete,
                status=CoachAthleteRelationship.Status.ACTIVE,
            ).exists():
                return Response({'error': 'Not found'}, status=404)
        else:
            return Response({'error': 'Not found'}, status=404)

        serializer = StravaActivitySerializer(log)
        return Response(serializer.data)


@csrf_exempt
def strava_webhook(request):
    """
    Plain Django view — NOT a DRF APIView.
    Must respond HTTP 200 within 2 seconds.
    """
    if request.method == 'GET':
        verify_token = request.GET.get('hub.verify_token')
        challenge = request.GET.get('hub.challenge')
        if verify_token == getattr(settings, 'STRAVA_WEBHOOK_VERIFY_TOKEN', ''):
            return JsonResponse({'hub.challenge': challenge})
        return HttpResponse(status=403)

    if request.method == 'POST':
        # Validate HMAC signature
        client_secret = getattr(settings, 'STRAVA_CLIENT_SECRET', '')
        if client_secret:
            signature = request.headers.get('X-Hub-Signature', '')
            body = request.body
            expected = 'sha256=' + hmac.new(
                client_secret.encode(),
                body,
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature, expected):
                logger.warning('Strava webhook HMAC validation failed')
                return HttpResponse(status=403)

        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponse(status=400)

        # Enqueue immediately — do NOT process inline
        from .tasks import process_strava_webhook
        process_strava_webhook.apply_async(args=[payload], queue='strava_sync')
        return HttpResponse(status=200)

    return HttpResponse(status=405)
