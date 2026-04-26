interface Session {
	id: string;
	roles: string[];
}

const defaultSession: Session = {
	id: "anonymous",
	roles: [],
};

export function createSession(overrides: Partial<Session> = {}): Session {
	return Object.assign(defaultSession, overrides);
}

export function addRole(session: Session, role: string): Session {
	session.roles.push(role);
	return session;
}
