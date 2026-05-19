from __future__ import annotations

import csv
from datetime import date
from io import BytesIO, StringIO

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.models import User

from .models import CoachNote
from .serializers import CoachNoteCreateSerializer, CoachNoteSerializer
from .services import (
    athlete_in_roster,
    build_athlete_info,
    build_athlete_metrics_payload,
    build_session_history,
    build_stroke_distribution_for_team,
    build_team_athlete_rows,
    get_date_range,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def athlete_metrics(request):
    if request.user.role != 'athlete':
        return Response({'error': 'Only athletes can access this endpoint.'}, status=403)

    range_param = request.query_params.get('range', '8w')
    return Response(build_athlete_metrics_payload(request.user, range_param))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def team_metrics(request):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can access this endpoint.'}, status=403)

    range_param = request.query_params.get('range', '8w')
    range_start = get_date_range(range_param)
    athlete_rows = build_team_athlete_rows(request.user, range_start, date.today())
    athlete_ids = [row['id'] for row in athlete_rows]

    compliance_values = [row['compliance'] for row in athlete_rows if row['compliance'] is not None]
    swolf_values = [row['swolf_avg'] for row in athlete_rows if row['swolf_avg'] is not None]

    payload = {
        'range': range_param if range_param in {'4w', '8w', '12w', 'season'} else '8w',
        'summary': {
            'team_swolf_avg': round(sum(swolf_values) / len(swolf_values), 1) if swolf_values else None,
            'team_compliance': round(sum(compliance_values) / len(compliance_values), 1) if compliance_values else None,
            'at_risk_count': sum(1 for athlete in athlete_rows if athlete['status'] == 'at_risk'),
            'total_athletes': len(athlete_rows),
            'active_athletes': sum(1 for athlete in athlete_rows if athlete['sessions_completed'] > 0),
        },
        'athletes': athlete_rows,
        'stroke_distribution': build_stroke_distribution_for_team(athlete_ids, range_start),
    }
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coach_athlete_metrics(request, athlete_id):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can access this endpoint.'}, status=403)

    athlete = get_object_or_404(User, id=athlete_id, role='athlete')
    if not athlete_in_roster(request.user, athlete):
        return Response({'error': 'Athlete not in your active roster.'}, status=403)

    range_param = request.query_params.get('range', '8w')
    range_start = get_date_range(range_param)
    payload = build_athlete_metrics_payload(athlete, range_param)
    payload['athlete_info'] = build_athlete_info(athlete)
    payload['session_history'] = build_session_history(athlete, range_start)
    payload['coach_notes'] = CoachNoteSerializer(
        CoachNote.objects.filter(coach=request.user, athlete=athlete), many=True
    ).data
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_team_metrics(request):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can export team metrics.'}, status=403)

    format_type = request.query_params.get('format', 'csv')
    range_param = request.query_params.get('range', '8w')
    range_start = get_date_range(range_param)
    athlete_rows = build_team_athlete_rows(request.user, range_start, date.today())
    filename = f'swimcoach-team-{date.today().isoformat()}'

    if format_type == 'csv':
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Athlete', 'Distance (m)', 'SWOLF Avg', 'Pace (sec/100m)', 'HR Avg', 'Compliance (%)', 'Status'])
        for athlete in athlete_rows:
            writer.writerow([
                athlete['last_session_date'] or '',
                athlete['name'],
                '',
                athlete['swolf_avg'] or '',
                '',
                '',
                athlete['compliance'] or '',
                athlete['status'],
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
        return response

    if format_type == 'pdf':
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import mm
            from reportlab.pdfgen import canvas
        except ImportError:
            return Response({'error': 'PDF export not available'}, status=501)

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 20 * mm
        pdf.setFont('Helvetica-Bold', 14)
        pdf.drawString(15 * mm, y, 'SwimCoach Team Analytics')
        y -= 10 * mm
        pdf.setFont('Helvetica', 10)
        pdf.drawString(15 * mm, y, f'Range: {range_param}')
        y -= 8 * mm
        for athlete in athlete_rows:
            line = f"{athlete['name']} | compliance {athlete['compliance'] or '—'} | swolf {athlete['swolf_avg'] or '—'} | {athlete['status']}"
            pdf.drawString(15 * mm, y, line[:100])
            y -= 6 * mm
            if y < 20 * mm:
                pdf.showPage()
                y = height - 20 * mm
                pdf.setFont('Helvetica', 10)
        pdf.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
        return response

    return Response({'error': 'Invalid export format.'}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_coach_note(request):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can write notes.'}, status=403)

    serializer = CoachNoteCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    athlete = get_object_or_404(User, id=serializer.validated_data['athlete_id'], role='athlete')
    if not athlete_in_roster(request.user, athlete):
        return Response({'error': 'Athlete not in your active roster.'}, status=403)

    note = CoachNote.objects.create(
        coach=request.user,
        athlete=athlete,
        content=serializer.validated_data['content'],
    )
    return Response(CoachNoteSerializer(note).data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_coach_notes(request, athlete_id):
    if request.user.role != 'coach':
        return Response({'error': 'Only coaches can view notes.'}, status=403)

    athlete = get_object_or_404(User, id=athlete_id, role='athlete')
    if not athlete_in_roster(request.user, athlete):
        return Response({'error': 'Athlete not in your active roster.'}, status=403)

    notes = CoachNote.objects.filter(coach=request.user, athlete=athlete)
    return Response(CoachNoteSerializer(notes, many=True).data)
