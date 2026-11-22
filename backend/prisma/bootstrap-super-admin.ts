import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
	const name = process.env.SUPER_ADMIN_NAME?.trim();
	const password = process.env.SUPER_ADMIN_PASSWORD;

	if (!email || !name || !password || password.length < 10 || password.length > 128) {
		throw new Error('Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, and a 10-128 character SUPER_ADMIN_PASSWORD before bootstrapping.');
	}

	const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
	if (existing) {
		throw new Error(`An account for ${email} already exists with role ${existing.role}; no account or password was changed.`);
	}

	await prisma.user.create({
		data: {
			email,
			name,
			role: 'SUPER_ADMIN',
			passwordHash: await bcrypt.hash(password, 12)
		}
	});

	console.info(`Created the super-admin account for ${email}.`);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
