#!/usr/bin/env node

/** @format */

import sharpyy from 'sharpyy';

import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigType, Package } from './types/interfaces.js';

const delay = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

(async () => {
	const ora = (await import('ora')).default;
	const inquirer = (await import('inquirer')).default;

	const shell = promisify(exec);
	const pkg: Package = JSON.parse(fs.readFileSync(path.join(process.cwd(), `package.json`), `utf8`));

	const spinner = ora(),
		time = (date: Date) =>
			date
				.toLocaleTimeString()
				.split(/ /gim)
				.map((str) =>
					str
						.split(`:`)
						.map((str) => (isNaN(Number(str)) ? str : sharpyy(str, `txCyan`)))
						.join(`:`)
				)
				.join(` `);

	const base = () => `${sharpyy(`PUBLISHYY`, `txRainbow`, `bold`)} | ${time(new Date())} | ${sharpyy(String(Math.round(process.memoryUsage().rss / 10000) / 100), `txCyan`)}mb |`;

	await spinner.succeed(base() + 'Checking for config file...');

	const configFiles = ['pub.config.js', 'pub.config.ts', 'pubconfig.json'];

	let configFile = null;

	await Promise.all(
		configFiles.map(async (file) => {
			if (fs.existsSync(path.resolve(`./${file}`))) {
				await spinner.succeed(`${base()} Config file found: ${file}`);

				configFile = await import(`file://${path.resolve(`./${file}`)}`);

				configFile = configFile?.default || configFile;

				return;
			}
		})
	);

	configFile = configFile as ConfigType;

	if (!configFile) await spinner.warn(`${base()} No config file found`);

	if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
		let update = configFile?.update;

		if (update == undefined) update = (await inquirer.prompt({ name: `update`, type: `confirm`, message: `${base()} Check for latest versions of dependencies?` })).update;

		if (update) {
			const updates: Array<string> = [];

			await Promise.all(
				Object.entries(pkg.dependencies).map(async ([name, version]) => {
					try {
						await spinner.start(`${base()} Checking ${name} for latest version...`);

						const { stdout: latest } = await shell(`npm view ${name} version`);

						const versions = {
							latest: latest.replace(/\n/g, ``),
							current: version.replace(/\^/g, ``),
						};

						if (versions.latest != versions.current) {
							await spinner.stop();

							const [Lmajor, Lminor, Lpatch] = versions.latest.split(`.`);
							const [Cmajor, Cminor, Cpatch] = versions.current.split(`.`);

							let update = false;

							if (Lmajor > Cmajor) {
								const { major } = await inquirer.prompt({
									name: `major`,
									type: `confirm`,
									message: `${base()} A major version update has been found for ${name}. Update from ${versions.current} to ${versions.latest}?`,
								});

								update = major;
							} else if (Lminor > Cminor) {
								const { minor } = await inquirer.prompt({
									name: `minor`,
									type: `confirm`,
									message: `${base()} A minor version update has been found for ${name}. Update from ${versions.current} to ${versions.latest}?`,
								});

								update = minor;
							} else if (Lpatch > Cpatch) {
								const { patch } = await inquirer.prompt({
									name: `patch`,
									type: `confirm`,
									message: `${base()} A patch version update has been found for ${name}. Update from ${versions.current} to ${versions.latest}?`,
								});

								update = patch;
							} else {
								await spinner.succeed(`${base()} latest version of ${name} is already installed.`);
							}

							if (update) updates.push(name);
						}
					} catch (err) {
						await spinner.fail(`${base()} ${name}`);
					}
				})
			);

			if (updates.length) {
				await spinner.start(`${base()} Updating dependencies: ${updates.join(`, `)}`);

				await shell(`npm install ${updates.map((dependency) => `${dependency}@latest`).join(` `)}`).catch((err) => {
					spinner.fail(`${base()} Failed to update dependencies, exiting instance.`);
					process.exit(1);
				});

				await spinner.succeed(`${base()} Dependencies have been updated successfully.`);
			} else {
				await spinner.succeed(`${base()} All dependencies are up to date.`);
			}
		}
	}

	let bundle = configFile?.bundle;

	if (bundle == undefined) bundle = (await inquirer.prompt({ name: `bundle`, type: `confirm`, message: `${base()} Bundle the project?` })).bundle;

	if (bundle) {
		await spinner.start(`${base()} Installing typescript and tsup as dev dependencies...`);

		await shell(`npm install -D tsup typescript`);

		await spinner.start(`${base()} Bundling project...`);

		const { stdout, stderr } = await shell(`npx tsup`);

		if (stdout.length) await spinner.succeed(`${base()} Project has been bundled successfully.`);
		if (stderr.length) {
			await spinner.fail(`${base()} Failed to bundle project, exiting instance.`);

			throw new Error(stderr);
		}
	} else {
		await spinner.start(`${base()} Installing typescript as dev dependency...`);

		await shell(`npm install -D typescript`);

		await spinner.start(`${base()} Building project...`);

		await shell(`npx tsc`);

		await spinner.succeed(`${base()} Project has been build successfully.`);
	}

	let check = configFile?.checkTypes;

	if (check == undefined) check = (await inquirer.prompt({ name: `check`, type: `confirm`, message: `${base()} Check if types are exported correctly?` })).check;

	if (check) {
		await spinner.start(`${base()} Installing @arethetypeswrong/cli as dev dependency...`);

		await shell(`npm i -D @arethetypeswrong/cli`);

		await spinner.start(`${base()} Checking types...`);

		await shell(`npx attw --pack`)
			.then(({ stdout }) => console.log(stdout))
			.catch(({ stdout }) => console.log(stdout));

		await spinner.succeed(`${base()} Types are exported correctly.`);
	} else await spinner.succeed(`${base()} Skipping type checking.`);

	await delay(1000);

	let typedoc = configFile?.typedoc;

	if (typedoc == undefined) typedoc = (await inquirer.prompt({ name: `typedoc`, type: `confirm`, message: `${base()} Generate typedoc documentation?` })).typedoc;

	if (typedoc) {
		await spinner.start(`${base()} Installing typedoc as dev dependency...`);

		await shell(`npm i -D typedoc`);

		await spinner.start(`${base()} Generating documentation...`);

		await shell(`npx typedoc`)
			.then(({ stdout, stderr }) => spinner.succeed(`${base()} ${stdout || stderr}`))
			.catch(({ stdout, stderr }) => spinner.fail(`${base()} ${stdout || stderr}`));
	} else await spinner.succeed(`${base()} Skipping typedoc documentation generation.`);

	let format = configFile?.formatFolders;

	if (format == undefined) format = (await inquirer.prompt({ name: `format`, type: `checkbox`, message: `${base()} Format code?`, choices: [`./`, ...fs.readdirSync(`./`)] })).format;

	if (format?.length) {
		await spinner.start(`${base()} Installing prettier as dev dependency...`);

		await shell(`npm i -D prettier`);

		await spinner.start(`${base()} Formatting code...`);

		if (format.includes(`./`)) {
			await shell(`npx prettier --write .`);
		} else await shell(`npx prettier --write ${format.join(` `)}`);

		await spinner.succeed(`${base()} Code has been formatted.`);
	} else await spinner.succeed(`${base()} Skipping code formatting.`);

	const { add } = await inquirer.prompt({ name: `add`, type: `input`, message: `${base()} Add files to commit.`, required: true });

	await spinner.start(`${base()} Adding changes...`);

	await shell(`git add ${add}`);

	await spinner.succeed(`${base()} Changes have been added to the commit.`);

	const { commit } = await inquirer.prompt({ name: `commit`, type: `input`, message: `${base()} commit message.`, required: true });

	await spinner.start(`${base()} committing changes...`);

	await shell(`git commit -m "${commit}"`);

	await spinner.succeed(`${base()} Commit has been added.`);

	const { version } = await inquirer.prompt({ name: `version`, type: `list`, message: `${base()} Choose version type.`, choices: [`patch`, `minor`, `major`, `beta`, `custom`] });

	await spinner.start(`${base()} Versioning package...`);

	if (version === `custom`) {
		await spinner.stop();

		const { customVersion } = await inquirer.prompt({ name: `customVersion`, type: `input`, message: `${base()} Enter custom version.` });

		pkg.version = customVersion;

		await shell(`npm version ${pkg.version}`);
	} else if (version === `beta`) {
		if (!pkg.version.startsWith(`0.1.120-beta`)) pkg.version = `0.1.120-beta.0`;

		const current = pkg.version.split(`.`).pop();

		pkg.version = pkg.version.slice(0, pkg.version.length - 1) + String(Number(current) + 1);

		await shell(`npm version ${pkg.version}`);
	} else {
		await spinner.start(`${base()} Updating ${version} version...`);

		await shell(`npm version ${version}`);
	}

	await spinner.succeed(`${base()} Version has been updated to ${pkg.version}`);

	const { push } = await inquirer.prompt({ name: `push`, type: `input`, message: `${base()} additional parameters for pushing?` });

	await spinner.start(`${base()} Pushing changes...`);

	await shell(`git push ${push}`);

	await spinner.succeed(`${base()} Changes have been pushed to the remote repository.`);

	const { publish } = await inquirer.prompt({ name: `publish`, type: `confirm`, message: `${base()} Publish package to npm registry?` });

	if (publish) {
		await spinner.start(`${base()} Publishing package to npm registry...`);

		await shell(`npm publish ${version == 'beta' ? '--tag beta' : ''}`);

		await spinner.succeed(`${base()} Package has been published to the npm registry.`);
	}

	await spinner.stop();
})();
