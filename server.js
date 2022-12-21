import puppeteer from "puppeteer-extra";
import { executablePath } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import utils from "./utils.js";
import fetch from "node-fetch";
import request from "request-promise";
puppeteer.use(StealthPlugin());

const waitTillHTMLRendered = async (page, timeout = 30000) => {
	const checkDurationMsecs = 1000;
	const maxChecks = timeout / checkDurationMsecs;
	let lastHTMLSize = 0;
	let checkCounts = 1;
	let countStableSizeIterations = 0;
	const minStableSizeIterations = 3;

	while (checkCounts++ <= maxChecks) {
		let html = await page.content();
		let currentHTMLSize = html.length;

		let bodyHTMLSize = await page.evaluate(
			() => document.body.innerHTML.length
		);

		console.log(
			"last: ",
			lastHTMLSize,
			" <> curr: ",
			currentHTMLSize,
			" body html size: ",
			bodyHTMLSize
		);

		if (lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize)
			countStableSizeIterations++;
		else countStableSizeIterations = 0; //reset the counter

		if (countStableSizeIterations >= minStableSizeIterations) {
			console.log("Page rendered fully..");
			break;
		}

		lastHTMLSize = currentHTMLSize;
		await page.waitForTimeout(checkDurationMsecs);
	}
};

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
let cookieFilePath = "C:\\Users\\bxv0x\\Downloads\\cookies.txt";

let browser = await puppeteer.launch({
	args: ["--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"],
	headless: false,
	ignoreHTTPSErrors: true,
	executablePath: executablePath(),
});

let page = await browser.newPage();

await utils.initializeCookies(cookieFilePath, page);

async function downloadVideo(url, num) {
	let retries = 0;
	while (retries < 5) {
		try {
			await page.goto(url, {
				waitUntil: "load",
			});
			let pageTitle = await page.evaluate(() => {
				const pageTitleElement = document.querySelector(".page-title");
				return pageTitleElement.textContent;
			});
			let path = `completed/${num} ${utils.getFolderName(
				num
			)}/subtitles/`;
			let videoFile = `${pageTitle}.mkv`;
			videoFile = videoFile.replace(/[\\\/\:\*\?\"\<\>\|]/g, "");
			await waitTillHTMLRendered(page);
			await page.waitForTimeout(1000);
			var frames = await page.frames();
			const client = await page.target().createCDPSession();
			const cookies = (await client.send("Network.getAllCookies"))
				.cookies;
			let videoUrls = await frames.map((frame) => {
				return frame.url();
			});
			let filteredUrls = (await videoUrls).filter(
				(url) => !url.includes("instructure") && url.length >= 12
			);
			let videoUrl = (await filteredUrls)[0];
			if (videoUrl) {
				const regex = /\/Play\/(.+)/;
				let ResourceId = (await videoUrl).match(regex);
				if (ResourceId) {
					ResourceId = ResourceId[1];
					let cookieNameForAuth = `MediasiteAuthTickets-${ResourceId}`;
					const cookie = cookies.find(
						(cookie) => cookie.name === cookieNameForAuth
					);
					const value = cookie.value;
					let UrlReferrer = `${videoUrl}?authTicket=${value}`;
					let body = {
						getPlayerOptionsRequest: {
							ResourceId: ResourceId,
							QueryString: "",
							UseScreenReader: false,
							UrlReferrer: UrlReferrer,
						},
					};
					let bodyString = JSON.stringify(body);
					let cookieString = cookies
						.map((c) => `${c.name}=${c.value}`)
						.join("; ");
					let res = await fetch(
						"https://mediasite.engr.tamu.edu/Mediasite/PlayerService/PlayerService.svc/json/GetPlayerOptions",
						{
							credentials: "include",
							headers: {
								"User-Agent":
									"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
								Accept: "application/json, text/javascript, */*; q=0.01",
								"Accept-Language": "en-US,en;q=0.5",
								"Sec-Fetch-Dest": "empty",
								"Sec-Fetch-Mode": "no-cors",
								"Sec-Fetch-Site": "cross-site",
								"Content-Type":
									"application/json; charset=utf-8",
								"X-Requested-With": "XMLHttpRequest",
								Pragma: "no-cache",
								"Cache-Control": "no-cache",
								Cookie: cookieString,
							},
							referrer: "https://mediasite.engr.tamu.edu/",
							body: bodyString,
							method: "POST",
							mode: "cors",
						}
					);
					let vidRes = JSON.parse(await res.text());
					let Transcript = vidRes.d.Presentation.Transcript;
					let srtData = await JSONtoSRT(Transcript);
					let subsTitle = pageTitle.replace(
						/[\\\/\:\*\?\"\<\>\|]/g,
						""
					);
					if (!fs.existsSync(path)) {
						fs.mkdirSync(path);
					}
					fs.writeFileSync(`${path}${subsTitle}.srt`, srtData);
					console.log(
						`Subtitles downloaded and saved to ${pageTitle}.srt`
					);

					// let videoObjects =
					// 	vidRes.d.Presentation.Streams[0].VideoUrls;
					// const locations = videoObjects
					// 	.map((videoObject) => videoObject.Location)
					// 	.filter((location) => !location.includes("manifest"));
					// let actualVideoUrl = locations[0];

					// if (!fs.existsSync(path)) {
					// 	fs.mkdirSync(path);
					// }
					//console.log(`Video downloaded and saved to ${videoFile}`);
					// request(actualVideoUrl)
					// 	.pipe(fs.createWriteStream(`${path}${videoFile}`))
					// 	.on("finish", () => {
					// 		console.log(`Video downloaded and saved to ${videoFile}`);
					// 	});
					// await videoDL(actualVideoUrl, `${path}${videoFile}`);
					break;
				} else {
					retries++;
					console.log("Retrying");
				}
			} else {
				retries++;
				console.log("Retrying");
			}
		} catch (e) {
			console.log(e);
			retries++;
			console.log("Retrying");
		}
	}
}
async function videoDL(url, fileName) {
	const response = await fetch(url);
	const fileStream = fs.createWriteStream(fileName);
	response.body.pipe(fileStream);
	console.log(`Video downloaded and saved to ${fileName}`);
}

function JSONtoSRT(transcript) {
	let result = "";

	// Iterate over the transcription objects
	for (let i = 0; i < transcript.length; i++) {
		// Get the current transcription object
		const t = transcript[i];

		// Unescape the encoded text using the JSON.parse() function and a reviver function
		const text = JSON.parse(`"${t.Text}"`, (key, value) => {
			if (typeof value === "string") {
				return value.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
					return String.fromCharCode(parseInt(code, 16));
				});
			}
			return value;
		});

		// Format the start and end times as HH:MM:SS,milliseconds
		const startTime = formatTime(t.Time);
		const endTime = formatTime(t.EndTime);

		// Append a new SRT string to the result
		result += `${i + 1}\n${startTime} --> ${endTime}\n${text}\n\n`;
	}
	return result;
}
// Helper function to format a time in milliseconds as HH:MM:SS,milliseconds
function formatTime(time) {
	const hours = Math.floor(time / 3600000);
	const minutes = Math.floor((time % 3600000) / 60000);
	const seconds = Math.floor((time % 60000) / 1000);
	const milliseconds = time % 1000;
	return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(
		milliseconds,
		3
	)}`;
}

// Helper function to pad a number with leading zeros
function pad(num, size) {
	let s = String(num);
	while (s.length < size) {
		s = "0" + s;
	}
	return s;
}

// await downloadVideo(
// 	`https://tamu.instructure.com/${"/courses/3227475/modules/items/69916369"}`,
// 	`Module 2\\`
// );
let urls = utils.getUrls();
let num = 27;
// let dir = `completed/Module ${num}/`;
for (let url of urls) {
	if (!url) {
		num++;
	} else {
		try {
			let fixedUrl = `https://tamu.instructure.com/${url}`;
			await downloadVideo(fixedUrl, num);
		} catch (err) {
			console.log(err);
		}
	}
}

await page.close();
await browser.close();

// console.log(urls);
// let url = `https://tamu.instructure.com/${"/courses/3227475/modules/items/69916369"}`;
// await downloadVideo(url);
// const playCircle = await page.$(".play-arrow");
// console.log(playCircle);
// await playCircle.click();
// await utils.delay(100000);
