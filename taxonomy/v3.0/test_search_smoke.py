"""Deterministic glossary smoke tests only; does NOT test deployed search or user relevance."""
from pathlib import Path
import json, unicodedata, collections
P=Path(__file__).parent
def load(f):return json.loads((P/f).read_text(encoding='utf-8'))
def norm(s):return unicodedata.normalize('NFKC',s).casefold().strip().replace('·',' ').replace('_',' ').replace('-',' ').replace('  ',' ')
terms=load('capabilities.json');aliases=load('search-aliases.json');related=load('related-search-terms.json')
code_id={t['code']:t['id'] for t in terms}
index=collections.defaultdict(set)
for a in aliases:
    if a['axis']=='capability' and a['auto_match']=='yes':index[norm(a['term'])].add(a['term_id'])
cases={'객체 검출':'object_detection','object detection':'object_detection','이미지 분할':'image_segmentation','시계열 분석':'time_series_analysis','시계열 예측':'time_series_forecasting','RAG':'retrieval_augmented_generation','NER':'information_extraction','STT':'speech_to_text','GNN':'graph_neural_networks','문서 검색':'document_retrieval'}
for q,code in cases.items():
    assert index[norm(q)] == {code_id[code]}, (q,index[norm(q)],code_id[code])
for q in ['RL','EDA','DOE']:
    assert not index.get(norm(q)), 'unsafe abbreviation auto-matched: '+q
# No related-only term should create an EXACT mapping to its broader concept
for code,term in [('privacy_preserving_ml','Federated Learning'),('privacy_preserving_ml','Differential Privacy'),('explainable_ai','SHAP'),('llm_finetuning','LoRA'),('image_restoration','Super Resolution')]:
    assert code_id[code] not in index.get(norm(term),set()), 'overbroad exact synonym: '+term
    assert any(r['term_id']==code_id[code] and r['term']==term for r in related)
print(f'PASS: {len(cases)} glossary match cases, 3 ambiguous abbreviation checks, 5 semantic-boundary checks')
print('NOTE: All terms remain pending_review; tests assess expected mapping only, not production readiness.')
