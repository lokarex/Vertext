import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix'

const isDev = import.meta.env.MODE === 'development';
log.setLevel(isDev ? 'trace' : 'warn');

prefix.reg(log);
prefix.apply(log, {
    template: '[%t] (%n):',
    levelFormatter(level) {
        return level.toUpperCase();
    },
    timestampFormatter(date) {
        return date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1'); // 输出 "HH:MM:SS" 格式的时间
    }
})

export default log;
