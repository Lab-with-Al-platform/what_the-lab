from pathlib import Path
import json, re, collections, unicodedata, sys
P=Path(__file__).resolve().parent
def load(x): return json.loads((P/x).read_text(encoding='utf-8'))
def norm(x): return unicodedata.normalize('NFKC',x).casefold().strip().replace('·',' ').replace('_',' ').replace('-',' ').replace('  ',' ')
categories=load('categories.json'); caps=load('capabilities.json'); fields=load('research-fields.json')
aliases=load('search-aliases.json'); rel=load('related-search-terms.json'); groups=load('ui-filter-groups.json'); links=load('ui-group-members.json')
errors=[]; warnings=[]
def unique(items,key,tag):
    vals=[x[key] for x in items]
    if len(vals)!=len(set(vals)):errors.append('duplicate '+tag+' '+key)
unique(categories,'id','category');unique(caps+fields,'id','taxonomy term');unique(caps+fields,'code','taxonomy term');unique(groups,'id','ui group')
ct={x['id']:x for x in categories}; tt={x['id']:x for x in caps+fields}; gg={x['id']:x for x in groups}
for t in caps+fields:
    if t['category_id'] not in ct:errors.append('missing category '+t['id'])
    elif t['axis']!=ct[t['category_id']]['axis']:errors.append('axis mismatch '+t['id'])
    if not t['definition'].strip():errors.append('empty definition '+t['id'])
    if t['status'] not in {'pending_review','active','retired'}:errors.append('bad status '+t['id'])
    if not re.fullmatch('[a-z][a-z0-9_]*',t['code']):errors.append('bad code '+t['id'])
for m in links:
    if m['group_id'] not in gg or m['capability_id'] not in {t['id'] for t in caps}:errors.append('bad UI group link '+str(m))
seen=collections.defaultdict(set)
for a in aliases:
    if a['term_id'] not in tt:errors.append('alias FK missing '+a['term_id'])
    elif a['axis']!=tt[a['term_id']]['axis']:errors.append('alias axis '+a['term_id'])
    if a['relation'] not in {'EXACT','PREFERRED'}:errors.append('bad alias relation '+str(a))
    seen[(a['axis'],norm(a['term']))].add(a['term_id'])
for a in aliases:
    collision=len(seen[(a['axis'],norm(a['term']))])>1
    if collision and a['auto_match']!='no':errors.append('unsafe automatic collision '+a['term'])
for a in rel:
    if a['term_id'] not in tt:errors.append('related FK missing '+a['term_id'])
    if a['match_policy']!='suggest_only':errors.append('related term auto-match '+a['term'])
for t in caps+fields:
    if not any(a['term_id']==t['id'] and a['relation']=='PREFERRED' for a in aliases):errors.append('missing preferred '+t['id'])
print(f"records capability={len(caps)} research_fields={len(fields)} aliases={len(aliases)} related={len(rel)} groups={len(groups)} UI_links={len(links)}")
print(f"exact-term ambiguities(quarantined)={sum(len(v)>1 for v in seen.values())}")
print('VALIDATION:', 'PASS' if not errors else 'FAIL')
for e in errors:print('ERROR:',e)
for w in warnings:print('WARN:',w)
sys.exit(1 if errors else 0)
