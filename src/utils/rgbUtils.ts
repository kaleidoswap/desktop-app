import { Assignment } from '../slices/nodeApi/nodeApi.slice'

// Helper function to extract amount from assignment
export const getAssignmentAmount = (assignment: Assignment): number => {
    switch (assignment.type) {
      case 'Fungible':
        return assignment.value || 0
      case 'InflationRight':
        return assignment.value || 0
      case 'Any':
      case 'NonFungible':
      case 'ReplaceRight':
      default:
        return 0
    }
}