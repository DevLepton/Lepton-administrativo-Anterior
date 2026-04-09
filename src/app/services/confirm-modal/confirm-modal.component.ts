import { Component } from '@angular/core';
import { ConfirmModalService } from './confirm-modal-service';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.scss'
})
export class ConfirmModalComponent {
constructor(public confirm: ConfirmModalService) {}

  onBackdropClick(event: MouseEvent) {
    this.confirm.cancel();
  }
}
