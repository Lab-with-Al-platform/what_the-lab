"""Mock 전문가의 데이터 연결 상태를 확인한다. 실제 API·보안 테스트는 별도다."""
import json
from pathlib import Path
from collections import Counter
P = Path(__file__).resolve().parents[1] / 'data'
def load(filename): return json.loads((P / filename).read_text(encoding='utf-8'))
experts = load('experts.mock.json')
caps = {r['id'] for r in load('capabilities.snapshot.json')}
fields = {r['id'] for r in load('research-fields.snapshot.json')}
assert len(experts) == 20
assert len({x['id'] for x in experts}) == 20
assert len({x['slug'] for x in experts}) == 20
assert all(x['dataStatus'] == 'mock' and not x['isVerified'] and not x['requestEnabled'] for x in experts)
assert all(x['skillIds'] and set(x['skillIds']) <= caps for x in experts)
assert all(x['experienceFieldIds'] and set(x['experienceFieldIds']) <= fields for x in experts)
assert all(set(x['collaborationFieldIds']) <= fields for x in experts)
assert all(x['profileVisibility'] == 'public' for x in experts)
assert all(x['availability'] in ('available','negotiable') for x in experts)
print('PASS: 20 mock experts, unique IDs/slugs, valid CAP/FIELD references, demo-only flags')
print('Distinct skills:', len(set(k for x in experts for k in x['skillIds'])))
print('Distinct fields:', len(set(k for x in experts for k in x['experienceFieldIds'])))
