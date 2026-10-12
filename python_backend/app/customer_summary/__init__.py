"""The customer summary: what to change in the InDesign file, in words support can paste into a reply."""
from .payload import SUMMARY_VERSION, check_guides_payload, summary_payload
from .summary import CustomerSummary, build_customer_summary, display_template_name

__all__ = [
    'CustomerSummary', 'SUMMARY_VERSION', 'build_customer_summary', 'check_guides_payload', 'display_template_name',
    'summary_payload',
]
