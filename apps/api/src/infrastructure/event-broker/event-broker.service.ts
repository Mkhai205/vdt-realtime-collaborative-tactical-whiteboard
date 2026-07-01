import { Injectable } from "@nestjs/common"
import { Subject, Observable } from "rxjs"
import { filter, map } from "rxjs/operators"

export interface BrokerMessage<T = any> {
  pattern: string
  data: T
}

@Injectable()
export class EventBrokerService {
  private readonly message$ = new Subject<BrokerMessage>()

  /**
   * Publish một event lên broker
   */
  publish<T = any>(pattern: string, data: T): void {
    this.message$.next({ pattern, data })
  }

  /**
   * Subscribe lắng nghe một pattern event cụ thể
   */
  subscribe<T = any>(pattern: string): Observable<T> {
    return this.message$.asObservable().pipe(
      filter((msg) => msg.pattern === pattern),
      map((msg) => msg.data as T),
    )
  }
}
