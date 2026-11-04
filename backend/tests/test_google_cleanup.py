"""구글 캘린더 정리 스크립트 (구글 · DB 없이): 무엇을 지우고 무엇을 남기는지."""

from scripts.google_cleanup import to_delete


def test_deletes_only_ours_that_should_not_stay():
    events = [
        {"id": "lbs00001", "summary": "[미팅] 지운 일정"},  # DB에 없음 → 지움
        {"id": "lbs00003", "summary": "[미팅] 주간 미팅"},  # DB에 있음 → 남김
        {"id": "lbt00002", "summary": "✅ [요청] 끝난 요청"},  # 진행 중이 아님 → 지움
        {"id": "abc123", "summary": "내가 구글에서 직접 만든 일정"},  # 이 서비스가 넣은 게 아님 → 남김
        {"id": "lbc00003a", "summary": "[협업] 협업 시작"},  # 지난 시작일 → 지움
        {"id": "lbc00003b", "summary": "[협업] 협업 종료일"},  # 남길 목록에 있음 → 남김
    ]
    keep = {"lbs00003", "lbc00003b"}
    assert [item["id"] for item in to_delete(events, keep)] == ["lbs00001", "lbt00002", "lbc00003a"]