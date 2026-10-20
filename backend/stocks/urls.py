"""
URL routes for stock API endpoints.
"""

from django.urls import path
from . import views

app_name = 'stocks'

urlpatterns = [
    # Single quote
    path('quote/<str:symbol>/', views.StockQuoteView.as_view(), name='quote'),

    # Bulk quotes
    path('quotes/', views.BulkQuoteView.as_view(), name='bulk-quotes'),

    # Paginated USD instrument catalog
    path('catalog/', views.AssetCatalogView.as_view(), name='catalog'),

    # Search
    path('search/', views.SymbolSearchView.as_view(), name='search'),

    # Company profile
    path('profile/<str:symbol>/', views.CompanyProfileView.as_view(), name='profile'),

    # Historical data
    path('history/<str:symbol>/', views.StockHistoryView.as_view(), name='history'),

    # Stock news
    path('news/<str:symbol>/', views.StockNewsView.as_view(), name='news'),

    # Service status
    path('status/', views.ServiceStatusView.as_view(), name='status'),

    # Market status (holiday-aware)
    path('market-status/', views.MarketStatusView.as_view(), name='market-status'),

    # Cache management
    path('cache/clear/', views.clear_cache, name='clear-cache'),

    # Convenience endpoints - US
    path('popular/', views.PopularStocksView.as_view(), name='popular'),
    path('crypto/', views.CryptoQuotesView.as_view(), name='crypto'),

    # Market indices (US/IN based on market param)
    path('indices/', views.MarketIndicesView.as_view(), name='indices'),

]
