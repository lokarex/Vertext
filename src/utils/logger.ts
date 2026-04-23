import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix'

const isDev = import.meta.env.MODE === 'development';
log.setLevel(isDev ? 'trace' : 'warn');

prefix.reg(log);
prefix.apply(log, {
    template: '[%t] %l (%n):',

    timestampFormatter(date) {
        return date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1');
    },
    levelFormatter(level) {
        return level.toUpperCase();
    },
    nameFormatter(name) {
        return name || 'root';
    },
})

export default log;
