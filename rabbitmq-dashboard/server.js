// 文件: rabbitmq-dashboard/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 配置
const RABBITMQ_API_URL = process.env.RABBITMQ_API_URL || 'http://rabbitmq:15672/api';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'sadms-order';
const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'sadms-order';
const UPDATE_INTERVAL = 3000; // 更新间隔（毫秒）

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// HTTP基本认证
const authHeader = 'Basic ' + Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString('base64');

// 获取RabbitMQ数据的函数
async function getRabbitMQData() {
    try {
        // 获取概览信息
        const overviewResponse = await axios.get(`${RABBITMQ_API_URL}/overview`, {
            headers: { 'Authorization': authHeader }
        });

        // 获取队列信息
        const queuesResponse = await axios.get(`${RABBITMQ_API_URL}/queues`, {
            headers: { 'Authorization': authHeader }
        });

        // 获取交换机信息
        const exchangesResponse = await axios.get(`${RABBITMQ_API_URL}/exchanges`, {
            headers: { 'Authorization': authHeader }
        });

        // 获取连接信息
        const connectionsResponse = await axios.get(`${RABBITMQ_API_URL}/connections`, {
            headers: { 'Authorization': authHeader }
        });

        // 获取通道信息
        const channelsResponse = await axios.get(`${RABBITMQ_API_URL}/channels`, {
            headers: { 'Authorization': authHeader }
        });

        // 获取绑定信息
        const bindingsResponse = await axios.get(`${RABBITMQ_API_URL}/bindings`, {
            headers: { 'Authorization': authHeader }
        });

        return {
            overview: overviewResponse.data,
            queues: queuesResponse.data,
            exchanges: exchangesResponse.data,
            connections: connectionsResponse.data,
            channels: channelsResponse.data,
            bindings: bindingsResponse.data,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('获取RabbitMQ数据出错:', error.message);
        return {
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// 为特定队列获取消息
async function getQueueMessages(queueName, count = 5) {
    try {
        const response = await axios.post(
            `${RABBITMQ_API_URL}/queues/%2F/${queueName}/get`,
            {
                count: count,
                ackmode: 'ack_requeue_true',
                encoding: 'auto',
                truncate: 50000
            },
            {
                headers: { 'Authorization': authHeader }
            }
        );

        return response.data;
    } catch (error) {
        console.error(`获取队列 ${queueName} 的消息出错:`, error.message);
        return [];
    }
}

// 定期更新数据
let updateInterval;

// Socket.io连接处理
io.on('connection', async (socket) => {
    console.log('客户端已连接');

    // 发送初始数据
    try {
        const initialData = await getRabbitMQData();
        socket.emit('rabbitmq-data', initialData);
    } catch (error) {
        console.error('发送初始数据出错:', error.message);
        socket.emit('error', { message: error.message });
    }

    // 处理获取队列消息的请求
    socket.on('get-queue-messages', async (data) => {
        try {
            const messages = await getQueueMessages(data.queueName, data.count || 5);
            socket.emit('queue-messages', {
                queueName: data.queueName,
                messages: messages
            });
        } catch (error) {
            console.error('获取队列消息出错:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    // 如果这是第一个连接，启动更新间隔
    if (!updateInterval) {
        updateInterval = setInterval(async () => {
            if (io.engine.clientsCount > 0) {
                try {
                    const data = await getRabbitMQData();
                    io.emit('rabbitmq-data', data);
                } catch (error) {
                    console.error('send update error:', error.message);
                    io.emit('error', { message: error.message });
                }
            }
        }, UPDATE_INTERVAL);
    }

    socket.on('disconnect', () => {
        console.log('client disconnect');

        // 如果没有更多连接，清除更新间隔
        if (io.engine.clientsCount === 0) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    });
});

// API
app.get('/api/rabbitmq', async (req, res) => {
    try {
        const data = await getRabbitMQData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/queues/:queueName/messages', async (req, res) => {
    try {
        const messages = await getQueueMessages(req.params.queueName, req.query.count || 5);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// front-end
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// start-server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`RabbitMQ Monitor server running on port ${PORT}`);
});