module.exports = {
  apps : [{
    name: 'ELK_TASK',
    script: 'ELK_Timing_task.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    error_file: 'elk_error_log.log',
    out_file: 'elk_out_log.log'
  }],
};
