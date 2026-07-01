import { Global, Module } from "@nestjs/common"
import { EventBrokerService } from "./event-broker.service"

@Global()
@Module({
  providers: [EventBrokerService],
  exports: [EventBrokerService],
})
export class EventBrokerModule {}
