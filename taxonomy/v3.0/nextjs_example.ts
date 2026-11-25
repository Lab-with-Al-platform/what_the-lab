// Next.js/React reference pseudocode; adapt paths to your actual repo.
import capabilities from './capabilities.json';
import groups from './ui-filter-groups.json';
import members from './ui-group-members.json';
// The UI displays a group; it does not certify that any single expert owns all members.
export function expandUiGroup(groupId: string): string[] {
  return members.filter(m => m.group_id === groupId).map(m => m.capability_id);
}
export function filterExpertsMock(experts: any[], selectedIds: string[], fieldIds: string[]) {
  return experts.filter(e => {
    const technicalMatch = !selectedIds.length || selectedIds.some(id => e.capabilityIds.includes(id));
    const fieldMatch = !fieldIds.length || fieldIds.some(id => e.experienceFieldIds.includes(id));
    return e.public === true && technicalMatch && fieldMatch;
  });
}
// For production: replace client-side filtering with authenticated server API.
