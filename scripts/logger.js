import fs from "fs";
import path from "path";
import util from "util";

const LOG_FILE_NAME = "app.log";
const OLD_LOG_FILE_NAME = "app.old.log";
const MAX_LOG_SIZE = 5 * 1024 * 1024;

export default class Logger {
    static #file = null;
    static #stream = null;

    static init(dirPath) {
        try {
            if (!dirPath) return null;
            fs.mkdirSync(dirPath, { recursive: true });

            const file = path.join(dirPath, LOG_FILE_NAME);
            Logger.#rotateIfNeeded(file);
            fs.closeSync(fs.openSync(file, "a"));

            Logger.#file = file;
            Logger.#stream = fs.createWriteStream(file, { flags: "a" });
            Logger.#stream.on("error", (err) => {
                console.error("写入日志文件失败:", err);
                Logger.#stream = null;
            });
            process.on("exit", () => {
                try {
                    Logger.#stream?.end();
                } catch {}
            });

            return file;
        } catch (err) {
            console.error("初始化日志文件失败:", err);
            return null;
        }
    }

    static getLogFile() {
        return Logger.#file;
    }

    static #rotateIfNeeded(file) {
        try {
            if (!fs.existsSync(file)) return;
            const { size } = fs.statSync(file);
            if (size < MAX_LOG_SIZE) return;

            const old = path.join(path.dirname(file), OLD_LOG_FILE_NAME);
            if (fs.existsSync(old)) fs.rmSync(old);
            fs.renameSync(file, old);
        } catch (err) {
            console.error("轮转日志文件失败:", err);
        }
    }

    static #timestamp() {
        const now = new Date();
        const pad = (value, width = 2) => String(value).padStart(width, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.` + `${pad(now.getMilliseconds(), 3)}`;
    }

    static #format(arg) {
        if (arg === null) return "null";
        if (arg === undefined) return "undefined";
        if (typeof arg === "object") {
            return util.inspect(arg, {
                compact: false,
            });
        }
        return String(arg);
    }

    static #write(level, text) {
        if (!Logger.#stream) return;
        try {
            Logger.#stream.write(`[${Logger.#timestamp()}] [${level.toUpperCase()}] ${text}\n`);
        } catch (err) {
            console.error("写入日志文件失败:", err);
            Logger.#stream = null;
        }
    }

    static #print(level, color, ...args) {
        const text = args.map((a) => this.#format(a)).join(" ");
        console.log(`${color}[${level.toUpperCase()}]\x1b[0m ${text}`);
        Logger.#write(level, text);
    }

    static info(...args) {
        this.#print("info", "\x1b[32m", ...args);
    }

    static warn(...args) {
        this.#print("warn", "\x1b[33m", ...args);
    }

    static error(...args) {
        this.#print("error", "\x1b[31m", ...args);
    }
}
