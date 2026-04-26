interface Session {
	id: string;
	roles: string[];
}

const defaultSession: Session = {
	id: "anonymous",
	roles: [],
};

export function createSession(overrides: Partial<Session> = {}): Session {
	return { ...defaultSession, roles: [...defaultSession.roles], ...overrides };
}

export function addRole(session: Session, role: string): Session {
	session.roles.push(role);
	return session;
}
