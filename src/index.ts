import { apikey, sequence_id, showBrowser } from "./config";
import { browser } from "@crawlora/browser";

interface EventData {
  country?: string;
  league?: string;
  date?: string;
  time?: string;
  homeTeam?: string;
  awayTeam?: string;
  odds1?: string;
  odds2?: string;
}

export default async function ({ urls }: { urls: string }) {
  const urlsData = urls.trim()
    .split("\n")
    .map((v) => v.trim());
  for (const url of urlsData) {
    await browser(
      async ({ page, wait, output, debug }) => {
        try {
          page.setDefaultNavigationTimeout(60000);
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await page.waitForSelector(
            ".SportsCompetitionsEvents-styles-module-competitions-events-block",
            { timeout: 30000 }
          );

          const countryAndLeagueData = await page.$eval(
            ".CompetitionTitle-styles-module-title.CompetitionTitle-styles-module-caption",
            (element) => element.textContent?.trim() || ""
          );

          const events: EventData[] = await page.$$eval(
            ".SportsCompetitionsEvents-styles-module-competitions-events-block",
            (blocks, countryAndLeague) => {
              const result: EventData[] = [];
              let currentDate: string | undefined;

              blocks.forEach((block) => {
                Array.from(block.children).forEach((child) => {
                  if (
                    child.classList.contains(
                      "EventDateHeader-styles-module-event-date-header"
                    )
                  ) {
                    const dayHeader = child.textContent?.trim();
                    const match = dayHeader?.match(/(\d{1,2})\.(\d{1,2})/);

                    if (match) {
                      const [_, day, month] = match.map(Number);
                      const currentYear = new Date().getFullYear();
                      const eventDate = new Date(currentYear, month - 1, day);

                      // Adjust for IST timezone (UTC+5:30)
                      eventDate.setMinutes(eventDate.getMinutes() + 330);
                      currentDate = eventDate.toISOString().split("T")[0];
                    } else {
                      currentDate = new Date().toISOString().split("T")[0];
                    }
                  }

                  if (
                    child.classList.contains("EventRow-styles-module-event-row")
                  ) {
                    const time = child
                      .querySelector(".EventDateTime-styles-module-time")
                      ?.textContent?.trim();

                    const homeTeam = child
                      .querySelector(
                        ".EventTeams-styles-module-team:first-child .EventTeams-styles-module-team-title"
                      )
                      ?.textContent?.trim();

                    const awayTeam = child
                      .querySelector(
                        ".EventTeams-styles-module-team:last-child .EventTeams-styles-module-team-title"
                      )
                      ?.textContent?.trim();

                    const [odds1, odds2] = Array.from(
                      child.querySelectorAll<HTMLSpanElement>(
                        ".EventOddButton-styles-module-odd-button span"
                      )
                    ).map((span) => span.textContent?.trim());

                    if (currentDate && countryAndLeague) {
                      const [country, league] = countryAndLeague
                        .split("/")
                        .map((s) => s.trim());
                      result.push({
                        date: currentDate,
                        country,
                        league,
                        time,
                        homeTeam,
                        awayTeam,
                        odds1,
                        odds2,
                      });
                    }
                  }
                });
              });

              return result;
            },
            countryAndLeagueData
          );

          await Promise.all(
            events.map(async (event: any) => {
              await output.create({
                sequence_id,
                sequence_output: { ...event },
              });
            })
          );

          await wait(10);
        } catch (error: any) {
          debug("An error occurred:", error);

          if (error.name === "TimeoutError") {
            console.warn("Retrying due to navigation timeout...");
            await page.goto(url, { waitUntil: "load", timeout: 60000 });
          }
        }
      },
      { showBrowser, apikey }
    );
  }
}

//to-do if no match data is available then handel accordingly 