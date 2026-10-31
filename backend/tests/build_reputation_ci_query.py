"""Build a disposable CI PostgreSQL assertion using the EXACT production SQL.

Never connects to or mutates application databases. Runner uses a PostgreSQL
GitHub Actions service container populated by review_schema_smoke.sql.
"""
import re
import sys
from pathlib import Path

source = (Path(__file__).resolve().parents[1] / "app" / "reputation_store.py").read_text(encoding="utf-8")
match = re.search(r'REPUTATION_SQL\s*=\s*"""(.*?)"""', source, re.DOTALL)
if match is None:
    raise SystemExit("Production REPUTATION_SQL is missing")
sql = match.group(1).replace("%s", "ARRAY[20,40]::bigint[]")
if "%s" in sql:
    raise SystemExit("SQL includes unexpected placeholders")
output = Path(sys.argv[1])
output.write_text(
    "-- Disposable CI-only. Uses the production reputation SQL.\n"
    "CREATE TEMP TABLE ci_lab_trust AS\n" + sql.rstrip().rstrip(";") + ";\n"
    """
DO $check$
DECLARE n INTEGER; people INTEGER; score_total NUMERIC;
BEGIN
  IF (SELECT COUNT(*) FROM ci_lab_trust) != 1 THEN
    RAISE EXCEPTION 'Expected only one public expert to have an index row';
  END IF;
  SELECT review_count, reviewer_count, weighted_sum INTO n, people, score_total
  FROM ci_lab_trust WHERE expert_id=20;
  IF n != 5 OR people != 3 OR score_total != 24.55 THEN
    RAISE EXCEPTION 'Failed public gate / reviewer cap: count %, people %, sum %',
      n,people,score_total;
  END IF;
  IF EXISTS (SELECT 1 FROM ci_lab_trust WHERE expert_id=40) THEN
    RAISE EXCEPTION 'Private expert leaked to reputation SQL';
  END IF;
END $check$;
""",
    encoding="utf-8",
)
