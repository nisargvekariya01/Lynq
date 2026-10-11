import { EventEmitter } from "events";

class AnalyticsEventBus extends EventEmitter {}

const eventBus = new AnalyticsEventBus();
eventBus.setMaxListeners(500);

export default eventBus;
