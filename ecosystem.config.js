module.exports = {
  apps : [{
    name: 'ELK_TASK',
    script: 'ELK_Timing_task.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    error_file: 'error.log',
    out_file: 'out.log'
  }],
};
