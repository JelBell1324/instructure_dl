import puppeteer from "puppeteer-extra";
import { executablePath } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

class utils {
	static async delay(time) {
		return new Promise(function (resolve) {
			setTimeout(resolve, time);
		});
	}

	static async initializeCookies(cookieFilePath, page) {
		// Read the cookie file
		const cookieFile = fs.readFileSync(cookieFilePath, "utf8");

		// Split the file into lines
		const lines = cookieFile.split("\n");

		// Initialize an array to store the cookies
		const cookies = [];

		// Iterate over the lines and extract the relevant information for each cookie
		for (const line of lines) {
			// Skip lines that start with a '#' or are empty
			if (line.startsWith("#") || line.trim() === "") {
				continue;
			}

			// Split the line into fields
			const fields = line.split("\t");

			// Extract the cookie properties
			const cookie = {
				domain: fields[0],
				httpOnly: fields[1] === "TRUE",
				path: fields[2],
				secure: fields[3] === "TRUE",
				expirationDate: parseInt(fields[4], 10),
				name: fields[5],
				value: fields[6],
			};

			// Add the cookie to the array
			cookies.push(cookie);
		}

		for (const cookie of cookies) {
			await page.setCookie(cookie);
		}
	}

	static async updateUrls(page) {
		await page.goto("https://tamu.instructure.com/courses/3227475/modules");

		const urls = await page.evaluate(() => {
			// Select the list of items within the module
			const items = document.querySelectorAll(
				".context_module_items .context_module_item"
			);

			// Extract the URLs for each item
			return Array.from(items).map((item) => {
				// Find the link element within the item
				const link = item.querySelector("a.title");

				// Extract the href attribute from the link
				return link ? link.getAttribute("href") : null;
			});
		});

		fs.writeFile("asdf.txt", urls.join("\n"), function (err) {
			if (err) {
				console.error("Crap happens");
			}
		});
	}

	static getUrls() {
		let data = fs.readFileSync("urls.txt", "utf8");
		return data.split("\n");
	}

	static getFolderName(index) {
		let folderNames = [
			"Overview of Security",
			"Malware",
			"Malware Infections",
			"Security Applications and Devices",
			"Mobile Device Security",
			"Hardening",
			"Supply Chain Management",
			"Virtualization",
			"Application Security",
			"Secure Software Development",
			"Network Design",
			"Perimeter Security",
			"Cloud Security",
			"Automation",
			"Network Attacks",
			"Securing Networks",
			"Physical Security",
			"Facilities Security",
			"Authentication",
			"Access Control",
			"Risk Assessment",
			"Vulnerability Management",
			"Monitoring and Auditing",
			"Cryptography",
			"Hashing",
			"Public Key Infrastructure",
			"Security Protocols",
			"Planning for the Worst",
			"Social Engineering",
			"Policies and Procedures",
			"Incident Response and Forensics",
		];
		return folderNames[index - 1];
	}
}

export default utils;
