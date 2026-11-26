const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ManualAssessorProblem = 'name' | 'email' | 'duplicate' | 'limit' | null;

export function manualAssessorProblem(input: {
  name: string;
  email: string;
  existingEmails: string[];
  total: number;
  max?: number;
}): ManualAssessorProblem {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name && !email) return null;
  if (name.length < 2) return 'name';
  if (!EMAIL_PATTERN.test(email)) return 'email';
  if (input.existingEmails.some((existing) => existing.trim().toLowerCase() === email)) {
    return 'duplicate';
  }
  if (input.total >= (input.max ?? 20)) return 'limit';
  return null;
}

export function manualAssessorProblemMessage(problem: ManualAssessorProblem): string {
  switch (problem) {
    case 'name':
      return 'Enter the person name (at least 2 characters).';
    case 'email':
      return 'Enter a valid email address, for example name@company.com.';
    case 'duplicate':
      return 'This person is already in the list.';
    case 'limit':
      return 'You can assign up to 20 assessors.';
    default:
      return '';
  }
}

export function canAddManualAssessor(input: {
  name: string;
  email: string;
  existingEmails: string[];
  total: number;
}): boolean {
  return (
    input.name.trim().length >= 2 &&
    input.email.trim().length > 0 &&
    manualAssessorProblem(input) === null
  );
}
