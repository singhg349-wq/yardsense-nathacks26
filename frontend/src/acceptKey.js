// Identity of an accepted request line, shared by Requests and the app state.
export function acceptKey(projectId, request) {
  return [projectId, request.class, request.qty, request.start, request.finish].join(':')
}
