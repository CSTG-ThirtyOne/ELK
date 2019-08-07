'use strict';
const nodemailer = require('nodemailer');
const DEV_MODE = false;//false 为线上, true 为本地

const accountConfig = DEV_MODE ? {
    host : 'smtp.ethereal.email',
    port : 587,
    auth: {
        user: 'chgh3q4lgt7iqcla@ethereal.email',
        pass: 'qHHmeHer1SprHPFMEG'
    }
} : {
    host : 'smtp.qiye.163.com',
    port : 994,
    secure : true,
    auth: {
        user: 'zhuming@youshikoudai.com',
        pass: 'Zm19930710'
    }
}

const mailOptions = DEV_MODE ? {
    from: '"朱明" <doedpspuio5xaamr@ethereal.email>', // sender address
    to: 'zhuming@youshikoudai.com', // list of receivers
    subject: 'ELK日志分析test', // Subject line
} : {
    from: '"朱明" <zhuming@youshikoudai.com>', // sender address
    to: 'tech@youshikoudai.com', // list of receivers
    subject: 'ELK日志每日分析报告', // Subject line
}

function sendEmail(data) {
    nodemailer.createTestAccount((err, account) => {
        let transporter = nodemailer.createTransport(accountConfig);
        // send mail with defined transport object
        mailOptions.html = data;
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('send email success');
        });
    });
}

module.exports = sendEmail;