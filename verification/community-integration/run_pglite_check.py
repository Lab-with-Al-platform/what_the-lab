"""Execute the actual Alembic chain on an isolated WASM PostgreSQL instance."""
import json, os, subprocess, sys
from pathlib import Path

import argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project',required=True)
args=parser.parse_args()
BASE=Path(__file__).resolve().parent
ROOT=Path(args.project).expanduser().resolve()
sys.path.insert(0,str(ROOT/'backend'))
os.environ.update(DISCORD_CLIENT_ID='qa-only', DISCORD_CLIENT_SECRET='qa-only',
                  DISCORD_REDIRECT_URI='http://localhost:8000/api/v1/auth/discord/callback',
                  JWT_SECRET='qa-only-long-jwt-secret-01234567890123456789',
                  DISCORD_BOT_TOKEN='', DISCORD_GUILD_ID='',
                  DATABASE_URL='postgresql+psycopg://postgres:qa-only@127.0.0.1:55439/postgres?sslmode=disable')
server_log=(BASE/'pglite_server.log').open('w')
server=subprocess.Popen(['node',str(BASE/'pglite_server.mjs')],stdout=subprocess.PIPE,stderr=server_log,text=True)
try:
    assert 'ready' in server.stdout.readline()
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import NullPool
    from alembic.config import Config
    from alembic import command
    engine=create_engine(os.environ['DATABASE_URL'],connect_args={'prepare_threshold':None},poolclass=NullPool)
    with engine.begin() as connection:
        assert connection.execute(text("SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','insight_private','community_private')")).scalar_one()==0
        config=Config(str(ROOT/'backend/alembic.ini'))
        config.attributes['connection']=connection
        command.upgrade(config,'20261025_06')
        # Today's latest tables already contain real-shaped fixtures before board migrations.
        connection.execute(text("INSERT INTO public.users(user_id,discord_id,nickname,user_role,signup_step,is_admin) VALUES (1099511627776,'qa-big','QA 연구자','researcher','done',false),(2,'qa-expert','QA 개발자','expert','done',false),(3,'qa-admin','QA 관리자','expert','done',true)"))
        connection.execute(text("INSERT INTO public.researcher_profile(user_id,is_verified) VALUES (1099511627776,true)"))
        connection.execute(text("INSERT INTO public.expert(user_id,current_job,ai_career,is_public,introduce) VALUES (2,'researcher','3_5',true,'QA 이미지 분석 전문가')"))
        connection.execute(text("INSERT INTO public.research(research_id,user_id,status,title,description) VALUES (1,1099511627776,'registered','QA 비공개 연구 제목','외부에 반입하지 않는 연구 상세')"))
        connection.execute(text("INSERT INTO public.collaboration_request(request_id,research_id,expert_id,status,start_date,end_date,message) VALUES (100,1,2,'canceled',CURRENT_DATE,CURRENT_DATE+7,'이전 요청 보존 검증')"))
        connection.execute(text("INSERT INTO public.notification(user_id,type,actor_id,request_id) VALUES (2,'request_canceled',1099511627776,100)"))
        connection.execute(text("INSERT INTO public.notification_setting(user_id,discord_dm) VALUES (2,false)"))
        def snapshot(conn):
            return {table:conn.execute(text(f'SELECT row_to_json(t)::text FROM public.{table} t ORDER BY 1')).scalars().all()
                    for table in ['users','expert','researcher_profile','research','collaboration_request','notification','notification_setting']}
        before=snapshot(connection)
        command.upgrade(config,'head')
        assert snapshot(connection)==before, 'Existing member/request/notification data changed'
        current=connection.execute(text('SELECT version_num FROM public.insight_alembic_version')).scalar_one()
        assert current=='20261026_11'
        tables=connection.execute(text("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='community_private' AND c.relkind='r'")).all()
        assert len(tables)==8 and all(row[1] for row in tables)
        accessible=connection.execute(text("SELECT count(*) FROM pg_tables t CROSS JOIN pg_roles r WHERE t.schemaname='community_private' AND r.rolname IN ('anon','authenticated','service_role') AND has_table_privilege(r.rolname,quote_ident(t.schemaname)||'.'||quote_ident(t.tablename),'SELECT,INSERT,UPDATE,DELETE')")).scalar_one()
        assert accessible==0
        assert connection.execute(text("SELECT data_type FROM information_schema.columns WHERE table_schema='community_private' AND table_name='posts' AND column_name='author_id'")).scalar_one()=='bigint'
    # Real FastAPI + psycopg/PostgreSQL-dialect session, no OAuth/network credentials.
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import Session
    from app.main import app
    from app import user_store
    from app.community.access import get_session
    from app.security import create_access_token
    USERS={i:{'user_id':i,'discord_id':d,'nickname':n,'user_role':'researcher' if i>3 else 'expert','signup_step':'done','status':'active','is_admin':i==3}
           for i,d,n in [(1099511627776,'qa-big','QA 연구자'),(2,'qa-expert','QA 개발자'),(3,'qa-admin','QA 관리자')]}
    original=user_store.find_by_id
    user_store.find_by_id=lambda i:USERS.get(i)
    def database():
        with Session(engine) as session,session.begin(): yield session
    app.dependency_overrides[get_session]=database
    origin={'Origin':'http://localhost:3000'}
    with TestClient(app) as client:
        def login(i):
            client.cookies.clear()
            if i: client.cookies.set('access_token',create_access_token(i,USERS[i]['discord_id']))
        from uuid import uuid4
        login(1099511627776)
        value={'title':'PostgreSQL 원문 검증','body':'WASM PostgreSQL에서 실제 API와 migration을 검증합니다.','category':'question','visibility':'public','tags':['이미지 분석','RAG"질문'],'client_token':str(uuid4())}
        r=client.post('/api/v1/community/posts',headers=origin,json=value);assert r.status_code==201,r.text
        public=r.json()
        r=client.post('/api/v1/community/posts',headers=origin,json={**value,'visibility':'private','client_token':str(uuid4())});assert r.status_code==201,r.text
        private=r.json()
        assert client.get('/api/v1/community/posts',params={'tag':'이미지 분석'}).json()['total']==1
        login(2)
        assert client.get(f"/api/v1/community/posts/{private['id']}").status_code==404
        c=client.post(f"/api/v1/community/posts/{public['id']}/comments",headers=origin,json={'body':'실제 PG FK 댓글','client_token':str(uuid4())});assert c.status_code==201,c.text
        comment=c.json()
        login(1099511627776)
        assert client.put(f"/api/v1/community/posts/{public['id']}/status",headers=origin,json={'status':'resolved','expected_version':1,'accepted_comment_id':comment['id'],'accepted_comment_version':1}).status_code==200
        assert client.get('/api/v1/community/notifications').json()['unread']==1
        # Board content must not create collaboration notifications or leak into their payloads.
        with engine.connect() as connection:
            assert snapshot(connection)==before
        assert client.get('/api/v1/experts',params={'q':'QA'}).json()['total']==1
        sent=client.post('/api/v1/researcher/requests',json={'expert_id':2,'research_id':1,'start_date':'2026-10-27','end_date':'2026-11-27','message':'실제 SQL을 통과하는 협업 요청'})
        assert sent.status_code==200,sent.text
        request_id=sent.json()[0]['request_id']
        login(2)
        received=client.get('/api/v1/expert/requests')
        assert received.status_code==200 and any(r['request_id']==request_id for r in received.json()),received.text
        global_notifications=client.get('/api/v1/notifications').json()
        assert any(n['type']=='request_received' for n in global_notifications['items'])
        assert private['title'] not in json.dumps(global_notifications,ensure_ascii=False)
        accepted=client.post(f'/api/v1/expert/requests/{request_id}/accept',json={'message':'수락 검증'})
        assert accepted.status_code==200,accepted.text
        login(1099511627776)
        assert any(n['type']=='request_accepted' for n in client.get('/api/v1/notifications').json()['items'])
        started=client.post(f'/api/v1/researcher/requests/{request_id}/start')
        assert started.status_code==200,started.text
        assert next(r for r in started.json() if r['request_id']==request_id)['status']=='started'
        assert client.get('/api/v1/community/notifications').json()['unread']==1
    app.dependency_overrides.clear();user_store.find_by_id=original
    with engine.begin() as connection:
        for role in ['anon','authenticated','service_role']:
            connection.execute(text(f'SET LOCAL ROLE {role}'))
            with connection.begin_nested() as savepoint:
                try: connection.execute(text('SELECT title FROM community_private.posts'))
                except Exception: savepoint.rollback()
                else: raise AssertionError(f'{role} unexpectedly readable')
            connection.execute(text('RESET ROLE'))
        with connection.begin_nested() as savepoint:
            try: connection.execute(text('UPDATE community_private.posts SET accepted_comment_id=:comment,status=\'resolved\' WHERE id=:post'),{'comment':comment['id'],'post':private['id']})
            except Exception: savepoint.rollback()
            else: raise AssertionError('Cross-post answer FK not enforced')
    report={'engine':'PGlite WASM PostgreSQL (single connection, not native concurrency)',
            'revision':current,'migration_chain':'all 8 revisions applied (base -> latest06 with data -> board08)','tables':len(tables),'rls':True,'browser_roles_denied':True,
            'bigint_member':True,'exact_korean_json_tag':True,'real_fastapi_psycopg_crud':True,'cross_post_fk_enforced':True,
            'latest_data_preserved':True,'real_collaboration_request_accept_start':True,
            'global_and_board_notifications_separate':True,'expert_search_sql':True,
            'native_concurrency_verified':False}
    (BASE/'pglite_result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
finally:
    server.terminate();server.wait(timeout=10)
    server_log.close()
