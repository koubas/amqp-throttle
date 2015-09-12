# AMQP throttling interceptor (POC)

This interceptor consumes messages from one queue and
publishes them to another, throttling the message rate
using credit based QoS implementation.
