// C 담당 테스트용 검색 함수. 기존 /experts 화면은 변경하지 않는다.
import experts from "../../../taxonomy/mock-experts-v1/data/experts.mock.json";
import capabilities from "../../../taxonomy/mock-experts-v1/data/capabilities.snapshot.json";
import fields from "../../../taxonomy/mock-experts-v1/data/research-fields.snapshot.json";
import aliases from "../../../taxonomy/mock-experts-v1/data/search-aliases.snapshot.json";

export type MockExpert = (typeof experts)[number];
export type SearchOptions = { query?: string; skillId?: string; fieldId?: string; availableOnly?: boolean };

// 검색창의 띄어쓰기·대소문자 차이 때문에 결과가 달라지지 않게 맞춘다.
const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
const skillById = new Map(capabilities.map((skill) => [skill.id, skill]));
const fieldById = new Map(fields.map((field) => [field.id, field]));

// 표준명과 정확 동의어만 자동 매칭한다. 관련어는 같은 기술로 단정하지 않는다.
const searchTerms = aliases.filter((item) =>
  item.auto_match === "yes" && (item.relation === "PREFERRED" || item.relation === "EXACT")
);

export function skillName(id: string): string { return skillById.get(id)?.label_ko ?? id; }
export function fieldName(id: string): string { return fieldById.get(id)?.label_ko ?? id; }

export function findMockExperts(options: SearchOptions = {}): MockExpert[] {
  const query = normalize(options.query ?? "");
  const matchedSkills = new Set(searchTerms
    .filter((item) => item.axis === "capability" && query && normalize(item.term).includes(query))
    .map((item) => item.term_id));
  const matchedFields = new Set(searchTerms
    .filter((item) => item.axis === "research_field" && query && normalize(item.term).includes(query))
    .map((item) => item.term_id));

  return experts.filter((expert) => {
    if (expert.profileVisibility !== "public") return false;
    if (options.availableOnly && expert.availability !== "available") return false;
    if (options.skillId && !expert.skillIds.includes(options.skillId)) return false;
    // 경험 분야 기준 필터다. 희망 협업 분야로 임의 대체하지 않는다.
    if (options.fieldId && !expert.experienceFieldIds.includes(options.fieldId)) return false;
    if (!query) return true;
    const profileText = normalize([expert.displayName, expert.headline, expert.summary].join(" "));
    return profileText.includes(query) || expert.skillIds.some((id) => matchedSkills.has(id))
      || expert.experienceFieldIds.some((id) => matchedFields.has(id));
  });
}

export const mockSkills = capabilities.map((x) => ({ id: x.id, label: x.label_ko }));
export const mockFields = fields.map((x) => ({ id: x.id, label: x.label_ko }));
export function getMockExpert(id: string): MockExpert | undefined { return experts.find((e) => e.id === id); }
