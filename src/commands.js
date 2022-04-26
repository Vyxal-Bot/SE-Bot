import he from "he";
import moment from "moment";
import fetch from "node-fetch";
import config from "./config.js";
import responses from "./responses.js";
import { execute } from "./vyxal.js";

export default {
    run: async (args, reply, message) => {
        const data = args
            .match(/<code>(.*?)<\/code>/g)
            ?.map((x) => x.substring(6, x.length - 7));

        if (!data) {
            return reply + responses.NO_BACKTICKS;
        }

        const flags = args.split("<code>")[0].trim();
        const code = data.shift();
        const input = data.join("\n");

        if (code == "lyxal") {
            return reply + "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        }

        const { stdout, stderr } = await execute(flags, code, input);

        const output = [];

        if (stdout.trim() == "") {
            if (stderr.trim() == "") {
                return reply + "(output was empty)";
            }
        } else {
            for (const line of lines(stdout)) output.push(line);
            if (stderr.trim() != "") output.push("");
        }

        if (stderr != "") {
            output.push("STDERR:");
            for (const line of lines(stderr)) output.push(line);
        }

        if (output.length == 1 && output[0].length <= 450) {
            return reply + "`" + output[0].replaceAll("`", "\\`") + "`";
        }

        output.unshift(`[${message.mention}: ${message.message_id}]`);
        return output.map((line) => "    " + line).join("\n");
    },

    hyperping: async (_, reply, message) => {
        if (!(await message.client.isPrivileged(message.user_id))) {
            return (
                reply +
                responses.NOT_PRIVILEGED.replaceAll(
                    "USER_ID",
                    message.user_id.toString()
                )
            );
        }

        return (
            reply +
            (await message.client.hyperping())
                .map((name) => "@" + name.replaceAll(/\s+/g, ""))
                .join(" ") +
            " ^"
        );
    },

    promote: async (args, reply, message) => {
        const userId = parseInt(args);

        if (isNaN(userId)) {
            return reply + "That is not a valid user ID.";
        } else if (!(await message.client.isAdmin(message.user_id))) {
            return reply + "You must be an admin to promote users.";
        } else if (await message.client.isAdmin(userId)) {
            return (
                reply +
                "That user is already an admin (higher than privileged)."
            );
        } else if (await message.client.isPrivileged(userId)) {
            return reply + "That user is already privileged.";
        } else {
            await message.client.setUserLevel(userId, 1);
            return (
                reply +
                (await message.client.fetchUser(userId)).name +
                " is now privileged."
            );
        }
    },

    demote: async (args, reply, message) => {
        const userId = parseInt(args);

        if (isNaN(userId)) {
            return reply + "That is not a valid user ID.";
        } else if (!(await message.client.isAdmin(message.user_id))) {
            return reply + "You must be an admin to demote users.";
        } else if (await message.client.isAdmin(userId)) {
            return (
                reply +
                "That user is an admin (higher than privileged). If you are a bot owner, use `!!/deadmin " +
                userId +
                "` if you wish to remove their admin status."
            );
        } else if (!(await message.client.isPrivileged(userId))) {
            return reply + "That user is not privileged.";
        } else {
            await message.client.setUserLevel(userId, 0);
            return (
                reply +
                (await message.client.fetchUser(userId)).name +
                " is no longer privileged."
            );
        }
    },

    admin: async (args, reply, message) => {
        const userId = parseInt(args);

        if (isNaN(userId)) {
            return reply + "That is not a valid user ID.";
        } else if (!(await message.client.isOwner(message.user_id))) {
            return (
                reply + "You must be a bot owner to promote users to admins."
            );
        } else if (await message.client.isAdmin(userId)) {
            return reply + "That is user already an admin.";
        } else {
            await message.client.setUserLevel(userId, 2);
            return (
                reply +
                (await message.client.fetchUser(userId)).name +
                " is now an admin."
            );
        }
    },

    deadmin: async (args, reply, message) => {
        const userId = parseInt(args);

        if (isNaN(userId)) {
            return reply + "That is not a valid user ID.";
        } else if (!(await message.client.isOwner(message.user_id))) {
            return reply + "You must be a bot owner to demote admins.";
        } else if (!(await message.client.isAdmin(userId))) {
            return reply + "That user is not an admin.";
        } else {
            await message.client.setUserLevel(userId, 0);
            return (
                reply +
                (await message.client.fetchUser(userId)).name +
                " is no longer an admin (they are now a normal user; use `!!/promote " +
                userId +
                "` to grant them non-admin privileged status again)."
            );
        }
    },

    issue: async (args, reply, message, edited) => {
        if (edited) return;

        if (!(await message.client.isPrivileged(message.user_id))) {
            return (
                reply +
                responses.NOT_PRIVILEGED.replaceAll(
                    "USER_ID",
                    message.user_id.toString()
                )
            );
        }

        const match = args.match(
            /^((.+?)\s+)?<b>(.+?)<\/b>\s*?(\S.*?)?((\s+<code>.+?<\/code>)+)$/
        );

        if (!match) {
            return (
                reply +
                "Your syntax is incorrect: `!!/issue repo **title** body \\`tag\\` \\`tag\\`` (repo and body are optional; at least one tag is mandatory). Please re-type the command; edits are not watched for this command to prevent accidentally creating multiple issues."
            );
        }

        const repo = match[2] ?? "Vyxal";
        const title = match[3];
        const body = match[4] ?? "";
        const labels = match[5]
            .match(/<code>.+?<\/code>/g)
            .map((x) => x.substring(6, x.length - 7));

        const res = await gitRequest(`/repos/Vyxal/${repo}/issues`, {
            method: "POST",
            body: JSON.stringify({
                title,
                body: `${body}\n\n(created by ${message.user_name} [here](${message.transcript_link}))`,
                labels,
            }),
        });

        if (res.status == 404) {
            return reply + responses.ISSUE_404;
        } else if (res.status != 201) {
            let ans = await res.text();

            try {
                ans = JSON.parse(ans).message ?? ans;
            } catch {}

            return (
                reply +
                responses.ISSUE_FAIL.replaceAll(
                    "STATUS",
                    res.status.toString()
                ).replaceAll("MESSAGE", ans)
            ).substring(0, 500);
        }
    },

    _: async (_, reply, message, edited) => {
        let match;

        const client = message.client;
        const content = he.decode(message.content);

        if (
            content.match(
                /^!!\/\s*(status|((lol )?(yo)?u good( (there )?(my )?(epic )?(bro|dude|sis|buddy|mate|m8|gamer)?)?\?*))\s*$/i
            )
        ) {
            return `${reply}I am doing ${choice(responses.STATUSES)}.`;
        } else if (
            content.match(
                /^!!\/\s*(info|inf(ro|or)(mate?ion)?|wh?at( i[sz]|'s)? vyxal|what vyxal i[sz])\?*\s*$/i
            )
        ) {
            return reply + responses.INFOTEXT;
        } else if (
            content.match(
                /^!!\/\s*(w(h(o|y|at)|ut) (are|r) (you|yuo|yoo|u)(, you .+?)?\?*|h[ea]lp( pl[sz])?)\s*$/i
            )
        ) {
            return reply + responses.HELPTEXT;
        } else if (
            content.match(
                /^!!\/\s*(pl(ease|[sz]) )?(make|let|have) velociraptors maul (.+?)\s*$/i
            )
        ) {
            return `
                                                                   YOU CAN RUN, BUT YOU CAN'T HIDE, ${match[4].toUpperCase()}
                                                         ___._
                                                       .'  <0>'-.._
                                                      /  /.--.____")
                                                     |   \   __.-'~
                                                     |  :  -'/
                                                    /:.  :.-'
    __________                                     | : '. |
    '--.____  '--------.______       _.----.-----./      :/
            '--.__            \`'----/       '-.      __ :/
                  '-.___           :           \   .'  )/
                        '---._           _.-'   ] /  _/
                             '-._      _/     _/ / _/
                                 \_ .-'____.-'__< |  \___
                                   <_______.\    \_\_---.7
                                  |   /'=r_.-'     _\\ =/
                              .--'   /            ._/'>
                            .'   _.-'
       snd                 / .--'
                          /,/
                          |/\`)
                          'c=,
            `;
        } else if (
            (match = content.match(
                /^!!\/\s*(coffee|(make|brew)( a cup of)? coffee for) (.+?)\s*$/i
            ))
        ) {
            return `${reply}_brews a cup of coffee for @${match[4].replaceAll(
                /\s+/g,
                ""
            )}_`;
        } else if (
            content.match(
                /^!!\/\s*(sudo |pl(s|z|ease?) )?make? meh? (a )?coo?kie?\s*$/i
            )
        ) {
            if (content.indexOf("sudo") != -1) {
                if (await client.isAdmin(message.user_id)) {
                    return reply + "[SUDO] Here you go: 🍪";
                } else {
                    return reply + "No, you sussy baka.";
                }
            } else {
                if (Math.random() <= 0.75) {
                    return reply + "Here you go: 🍪";
                } else {
                    return reply + "No.";
                }
            }
        } else if (content.match(/^!!\/\s*ping me\s*$/i)) {
            await client.setPing(message.user_id, true);
            return reply + "I have put you on the ping list.";
        } else if (content.match(/^!!\/\s*(don't ping|pingn't) me\s*$/i)) {
            await client.setPing(message.user_id, false);
            return reply + "I have removed you from the ping list.";
        } else if (content.match(/^!!\/\s*am ?i ?privileged\?*\s*$/i)) {
            if (await client.isOwner(message.user_id)) {
                return reply + "You are a bot owner.";
            } else if (await client.isAdmin(message.user_id)) {
                return reply + "You are an admin.";
            } else if (await client.isPrivileged(message.user_id)) {
                return reply + "You are a privileged user.";
            } else {
                return (
                    reply +
                    responses.NOT_PRIVILEGED.replaceAll(
                        "USER_ID",
                        message.user_id.toString()
                    )
                );
            }
        } else if (content.match(/^!!\/\s*(update )?prod(uction)?\s*$/i)) {
            if (!(await client.isPrivileged(message.user_id))) {
                return (
                    reply +
                    responses.NOT_PRIVILEGED.replaceAll(
                        "USER_ID",
                        message.user_id.toString()
                    )
                );
            }

            const datestring = moment().format("YYYY-MM-DD");

            const res = await gitRequest("/repos/Vyxal/Vyxal/pulls", {
                method: "POST",
                body: JSON.stringify({
                    title: `Update Production (${datestring})`,
                    head: "main",
                    base: "production",
                    body: `Requested by ${message.user_name} [here](${message.transcript_link}).`,
                }),
            });

            if (res.status != 201) {
                let ans = await res.text();

                try {
                    ans = JSON.parse(ans).message ?? ans;
                    if (!ans) throw 0;
                } catch {
                    ans = res.body;
                }

                return (
                    reply +
                    responses.PROD_FAIL.replaceAll(
                        "STATUS",
                        res.status.toString()
                    ).replaceAll("MESSAGE", ans)
                ).substring(0, 500);
            }
        } else if (
            content.match(/^!!\/\s*(hello|howdy|mornin['g]|evenin['g])\s*$/i)
        ) {
            return reply + "Hello to you too!";
        } else if (
            content.match(/^!!\/\s*((good)?bye|see ya\!?|(good|')night)\s*$/i)
        ) {
            return reply + "o/";
        } else if (content.match(/^!!\/\s*flowey quote\s*$/i)) {
            return reply + choice(responses.FLOWEY_QUOTES);
        } else if (content.match(/^!!\/\s*hug\s*$/i)) {
            return reply + choice(responses.HUGS);
        } else if (content.match(/^!!\/\s*sus\s*$/i)) {
            return reply + "ඞ";
        } else if (content.match(/^!!\/\s*repo(sitor(y|ies))? list\s*$/i)) {
            const res = await gitRequest("/orgs/Vyxal/repos");

            if (res.status == 200) {
                const repositories = (await res.json()).filter(
                    (repo) => !repo.private
                );

                const inline =
                    reply +
                    repositories
                        .map((repo) => `[${repo.name}](${repo.html_url})`)
                        .join(" | ");
                if (inline.length <= 500) return inline;

                return (
                    reply +
                    repositories
                        .map((repo) => `- ${repo.name}: ${repo.html_url}`)
                        .join("\n")
                );
            }
        }
    },
};

function lines(text) {
    return text.match(/^\n*((.|\n)*?)\n*$/)[1].split("\n");
}

function choice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function gitRequest(url, options) {
    return await fetch("https://api.github.com" + url, {
        ...options,
        headers: {
            Authorization: "token " + config.github_token,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Vyxal-Bot",
        },
    });
}
