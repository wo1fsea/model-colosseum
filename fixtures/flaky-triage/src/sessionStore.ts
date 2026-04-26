interface Session {
	id: string;
	roles: string[];
}

export function createSession(overrides: Partial<Session> = {}): Session {
	return {
		id: overrides.id ?? "anonymous",
		roles: overrides.roles ? [...overrides.roles] : [],
	};
}

export function addRole(session: Session, role: string): Session {
	session.roles.push(role);
	return session;
}
