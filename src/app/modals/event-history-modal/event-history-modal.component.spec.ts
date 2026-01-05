import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventHistoryModalComponent } from './event-history-modal.component';

describe('EventHistoryModalComponent', () => {
  let component: EventHistoryModalComponent;
  let fixture: ComponentFixture<EventHistoryModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EventHistoryModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventHistoryModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
