import os
from datetime import date, datetime, timedelta, timezone

# Local day boundary (Damascus is UTC+3 by default).
_TZ = timezone(timedelta(hours=int(os.getenv("TZ_OFFSET", "3"))))


def today() -> date:
    return datetime.now(_TZ).date()


def hour() -> int:
    return datetime.now(_TZ).hour
