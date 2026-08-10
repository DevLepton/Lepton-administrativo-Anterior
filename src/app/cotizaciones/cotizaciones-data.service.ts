import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import {
  ApiService,
  ForeignTechnicianItem,
  QuoteItem,
  QuoteProductItem,
  SuggestionItem,
  TravelExpenseExtraItem,
  TravelExpenseItem
} from '../services/api.service';

export interface QuoteCatalogData {
  quotes: QuoteItem[];
  products: QuoteProductItem[];
  foreignTechnicians: ForeignTechnicianItem[];
  travelExpenses: TravelExpenseItem[];
  travelExpenseExtras: TravelExpenseExtraItem[];
  suggestions: SuggestionItem[];
}

@Injectable({ providedIn: 'root' })
export class CotizacionesDataService {
  private catalogCache$: Observable<QuoteCatalogData> | null = null;

  constructor(private api: ApiService) { }

  getCatalogData(forceRefresh = false): Observable<QuoteCatalogData> {
    if (!this.catalogCache$ || forceRefresh) {
      this.catalogCache$ = forkJoin({
        quotes: this.api.getQuotes(),
        products: this.api.getQuoteProducts(),
        foreignTechnicians: this.api.getForeignTechnicians(),
        travelExpenses: this.api.getTravelExpenses(),
        travelExpenseExtras: this.api.getTravelExpenseExtras(),
        suggestions: this.api.getSuggestions()
      }).pipe(
        map(({ quotes, products, foreignTechnicians, travelExpenses, travelExpenseExtras, suggestions }) => ({
          quotes: this.extractList(quotes).map(item => this.mapQuote(item)),
          products: this.extractList(products).map(item => this.mapProduct(item)),
          foreignTechnicians: this.extractList(foreignTechnicians).map(item => this.mapTechnician(item)),
          travelExpenses: this.extractList(travelExpenses).map(item => this.mapTravelExpense(item)),
          travelExpenseExtras: this.extractList(travelExpenseExtras).map(item => this.mapTravelExpenseExtra(item)),
          suggestions: this.extractList(suggestions).map(item => this.mapSuggestion(item))
        })),
        shareReplay(1)
      );
    }

    return this.catalogCache$;
  }

  clearCache(): void {
    this.catalogCache$ = null;
  }

  private extractList(response: any): any[] {
    if (Array.isArray(response?.data)) return response.data;
    if (response?.data && typeof response.data === 'object') return [response.data];
    if (Array.isArray(response?.quotes)) return response.quotes;
    if (Array.isArray(response?.products)) return response.products;
    if (Array.isArray(response?.foreignTechnicians)) return response.foreignTechnicians;
    if (Array.isArray(response?.travelExpenses)) return response.travelExpenses;
    if (Array.isArray(response?.travelExpenseExtras)) return response.travelExpenseExtras;
    if (Array.isArray(response?.travelExpensesExtras)) return response.travelExpensesExtras;
    if (Array.isArray(response?.suggestions)) return response.suggestions;
    if (Array.isArray(response)) return response;
    return [];
  }

  private mapQuote(item: any): QuoteItem {
    return {
      _id: String(item?._id ?? ''),
      quoteNum: String(item?.quoteNum ?? ''),
      userId: String(item?.userId ?? ''),
      clientName: String(item?.clientName ?? ''),
      companyName: String(item?.companyName ?? ''),
      place: String(item?.place ?? ''),
      validity: item?.validity,
      products: Array.isArray(item?.products)
        ? item.products.map((p: any) => ({
          name: String(p?.name ?? ''),
          description: String(p?.description ?? ''),
          price: Number(p?.price ?? 0),
          priceIVA: Number(p?.priceIVA ?? 0),
          discount: Number(p?.discount ?? 0),
          discountType: p?.discountType ?? '%',
          amount: Number(p?.amount ?? 0),
          total: Number(p?.total ?? 0)
        }))
        : [],
      subtotal: Number(item?.subtotal ?? 0),
      discounts: Number(item?.discounts ?? 0),
      IVA: Number(item?.IVA ?? 0),
      total: Number(item?.total ?? 0),
      units: item?.units != null ? Number(item.units) : undefined,
      model: String(item?.model ?? ''),
      paymentNextMonthly: item?.paymentNextMonthly != null ? Number(item.paymentNextMonthly) : undefined,
      billable: Boolean(item?.billable),
      bankName: String(item?.bankName ?? ''),
      paymentMethodHolder: String(item?.paymentMethodHolder ?? ''),
      accountNumber: String(item?.accountNumber ?? ''),
      CLABE: String(item?.CLABE ?? ''),
      comments: String(item?.comments ?? ''),
      createdAt: item?.createdAt
    };
  }

  private mapProduct(item: any): QuoteProductItem {
    return {
      _id: String(item?._id ?? item?.id ?? ''),
      type: item?.type,
      name: String(item?.name ?? ''),
      description: String(item?.description ?? ''),
      price: Number(item?.price ?? 0),
      priceIVA: Number(item?.priceIVA ?? 0),
      discount: Number(item?.discount ?? 0),
      duration: item?.duration ?? undefined,
      comments: String(item?.comments ?? ''),
      createdAt: item?.createdAt ?? undefined
    };
  }

  private mapTechnician(item: any): ForeignTechnicianItem {
    return {
      _id: String(item?._id ?? item?.id ?? ''),
      type: item?.type,
      name: String(item?.name ?? ''),
      cel: String(item?.cel ?? ''),
      bill: Boolean(item?.bill),
      city: String(item?.city ?? ''),
      ownLocal: Boolean(item?.ownLocal),
      address: String(item?.address ?? ''),
      installationPrice: Number(item?.installationPrice ?? 0),
      inspectionFee: Number(item?.inspectionFee ?? 0),
      withdrawalPrice: Number(item?.withdrawalPrice ?? 0),
      priceFalseReversal: Number(item?.priceFalseReversal ?? 0),
      travelExpensesPrice: Number(item?.travelExpensesPrice ?? 0),
      transferPrice: Number(item?.transferPrice ?? 0),
      comments: String(item?.comments ?? '')
    };
  }

  private mapTravelExpense(item: any): TravelExpenseItem {
    return {
      _id: String(item?._id ?? item?.id ?? ''),
      place: String(item?.place ?? ''),
      km: Number(item?.km ?? 0),
      booths: Array.isArray(item?.booths)
        ? item.booths.map((booth: any) => ({
          name: String(booth?.name ?? ''),
          cost: Number(booth?.cost ?? 0)
        }))
        : [],
      createdAt: item?.createdAt ?? undefined
    };
  }

  private mapTravelExpenseExtra(item: any): TravelExpenseExtraItem {
    return {
      _id: String(item?._id ?? item?.id ?? ''),
      kmRate: Number(item?.kmRate ?? 0),
      lodging: Number(item?.lodging ?? 0),
      breakfast: Number(item?.breakfast ?? 0),
      lunch: Number(item?.lunch ?? 0),
      dinner: Number(item?.dinner ?? 0),
      createdAt: item?.createdAt ?? undefined
    };
  }

  private mapSuggestion(item: any): SuggestionItem {
    return {
      _id: String(item?._id ?? ''),
      description: String(item?.description ?? ''),
      productId:
        typeof item?.productId === 'object'
          ? String(item.productId._id ?? '')
          : String(item?.productId ?? ''),
      action: item?.action,
      response: Array.isArray(item?.response)
        ? item.response.map((r: any) => ({
          action: r.action,
          productId:
            typeof r.productId === 'object'
              ? String(r.productId._id ?? '')
              : String(r.productId ?? '')
        }))
        : [],
      createdAt: item?.createdAt
    };
  }
}
