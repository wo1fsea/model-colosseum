interface Session {
	id: string;
	roles: string[];
}

const defaultSession: Session = {
	id: "anonymous",
	roles: [],
};

export function createSession(overrides: Partial<Session> = {}): Session {
	return { ...defaultSession, ...overrides, roles: overrides.roles ? [...overrides.roles] : [...defaultSession.roles] };
}

export function addRole(session: Session, role: string): Session {
	session.roles.push(role);
	return session;
}
