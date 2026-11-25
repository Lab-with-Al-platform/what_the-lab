"""실행 예: python -m app.insight_transfer sample.json --root tests/fixtures"""

import argparse
import json
from pathlib import Path

from app.insights.transfer_contract import TransferBundle, TransferError, load_transfer_file


def main() -> int:
    """파일 검사 결과만 출력합니다. DB 저장·승인·게시 기능은 없습니다."""
    parser = argparse.ArgumentParser(description="인사이트 전송 JSON 오프라인 검사")
    parser.add_argument("file", nargs="?", type=Path)
    parser.add_argument("--root", type=Path, help="파일을 읽어도 되는 폴더")
    parser.add_argument("--schema", action="store_true", help="작성 도구용 JSON Schema 출력")
    args = parser.parse_args()
    if args.schema:
        print(json.dumps(TransferBundle.model_json_schema(), ensure_ascii=False, indent=2))
        return 0
    if args.file is None or args.root is None:
        parser.error("검사할 file과 --root를 지정하세요.")
    try:
        bundle, digest = load_transfer_file(args.file, args.root)
    except TransferError as error:
        print(json.dumps({"valid": False, "error": str(error)}, ensure_ascii=False))
        return 2
    print(
        json.dumps(
            {
                "valid": True,
                "item_count": len(bundle.items),
                "sha256": digest,
                "db_written": False,
                "publication_approved": False,
                "notice": "형식 검사만 완료. 출처·권리·설정·키워드·PR 승인 확인은 별도입니다.",
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
