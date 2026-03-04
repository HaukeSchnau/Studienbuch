import type { DomainEvent as LibDomainEvent } from "@stu/lib";

export type DomainEvent = unknown extends LibDomainEvent ? any : LibDomainEvent;
