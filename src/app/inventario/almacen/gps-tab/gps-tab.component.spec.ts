import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GpsTabComponent } from './gps-tab.component';

describe('GpsTabComponent', () => {
  let component: GpsTabComponent;
  let fixture: ComponentFixture<GpsTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GpsTabComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GpsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
