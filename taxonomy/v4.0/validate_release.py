#!/usr/bin/env python3
"""Validate taxonomy data structure; does not certify semantics or service readiness."""
import json,collections,unicodedata
from pathlib import Path
P=Path(__file__).parent
read=lambda f:json.loads((P/f).read_text(encoding='utf-8'))
c=read('capabilities.json');f=read('research-fields.json'); cats=read('categories.json');a=read('search-aliases.json');r=read('related-search-terms.json'); u=read('ui-filter-groups.json');m=read('ui-group-members.json')
assert len(c)==80 and len(f)==83
IDs=[x['id'] for x in c+f]
assert len(IDs)==len(set(IDs))
assert all(x['category_id'] in {y['id'] for y in cats} for x in c+f)
assert all(x['term_id'] in set(IDs) for x in a+r)
assert all(x['capability_id'] in {y['id'] for y in c} and x['group_id'] in {z['id'] for z in u} for x in m)
index=collections.defaultdict(set)
for x in a:
 if x['relation'] in ('PREFERRED','EXACT') and x.get('auto_match')=='yes':
  k=(x['axis'],unicodedata.normalize('NFKC',x['term']).casefold().strip());index[k].add(x['term_id'])
assert not [k for k,v in index.items() if len(v)>1]
assert all(x.get('status')=='pending_review' for x in c+f),'Approval state changed; review signed approvals and adjust validator intentionally.'
print(f'PASS: structural refs | CAP={len(c)} FIELD={len(f)} aliases={len(a)} UI groups={len(u)}')
print('NOT VERIFIED: semantics, research standard crosswalk, real search quality, authorization, DB/API integration')
