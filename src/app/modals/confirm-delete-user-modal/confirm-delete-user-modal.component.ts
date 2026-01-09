import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-delete-user-modal',
  templateUrl: './confirm-delete-user-modal.component.html',
  styleUrl: './confirm-delete-user-modal.component.scss'
})
export class ConfirmDeleteUserModalComponent {
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  @Output() confirmed = new EventEmitter<void>();
  showModal = false;
  userName = '';
  private confirmAction!: () => void;

  open(userName: string, onConfirm: () => void) {
    this.userName = userName;
    this.confirmAction = onConfirm;
    this.showModal = true;
    this.lockBodyScroll();
  }

  close() {
    this.showModal = false;
    this.unlockBodyScroll();
  }

  confirm() {
    this.confirmed.emit();
    this.confirmAction();
    this.close();
  }

  onBackdropClick(event: MouseEvent) {
    this.close();
  }
}
