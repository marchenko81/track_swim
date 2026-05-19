from rest_framework.pagination import PageNumberPagination


class InsightPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_page_size(self, request):
        limit = request.query_params.get('limit')
        if limit:
            try:
                return min(int(limit), self.max_page_size)
            except (TypeError, ValueError):
                pass
        return super().get_page_size(request)
