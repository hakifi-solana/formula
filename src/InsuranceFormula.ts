import Big from 'big.js';
import CONFIG from './constants';
import {
  ENUM_INSURANCE_SIDE,
  ENUM_SYMBOL_PREDICTION,
  PERIOD_UNIT,
  TCalExpired,
  TCalPStop,
  TCalQClaim,
  TCalQuantityFuture,
  TCalRatioPredict,
  TCalSystemCapital,
  TCalSystemRisk,
  TGetDistancePClaim,
  TListRatioChange,
} from './types';

export class InsuranceFormula {
  public risk_config: number;
  public refund_ratio: number;
  public decimal_usdt: number;
  public min_period: number;
  public max_period: number;
  public diff_claim: number;
  public constant_claim: number;
  public ratio_different_price_claim: number;

  constructor() {
    this.refund_ratio = CONFIG.REFUND_RATIO;
    this.risk_config = CONFIG.RISK_CONFIG;
    this.decimal_usdt = CONFIG.DECIMAL_USDT;
    this.min_period = CONFIG.MIN_PERIOD;
    this.max_period = CONFIG.MAX_PERIOD;
    this.diff_claim = CONFIG.DIFFCLAIM;
    this.ratio_different_price_claim = CONFIG.RATIO_DIFFERENT_PRICE_CLAIM;
    this.constant_claim = 1;
  }

  public calculateSystemRisk(params: TCalSystemRisk) {
    const { day_change_token, ratio_profit } = params;
    const future_diff_stop = this.getDiffStop(ratio_profit);
    const percent_p_expired = Big(ratio_profit).plus(future_diff_stop);

    return Big(day_change_token).div(percent_p_expired).toNumber();
  }

  public calculateSystemCapital(params: TCalSystemCapital) {
    const { p_stop, p_open, day_change_token, ratio_profit, margin } = params;
    const system_risk = this.calculateSystemRisk({ p_stop, p_open, day_change_token, ratio_profit });

    if (Big(system_risk).gt(this.risk_config)) {
      return Big(margin).times(this.risk_config).div(system_risk).toNumber();
    } else {
      return Big(margin).plus(Big(this.risk_config).minus(system_risk).times(margin)).toNumber();
    }
  }

  public calculateRatioPredict(params: TCalRatioPredict) {
    const { p_open, p_claim } = params;
    return Big(p_claim).minus(p_open).abs().div(p_open).toNumber();
  }

  public getDiffStop(ratio_profit: number) {
    if (ratio_profit <= 0.05) {
      return 0.02;
    }
    if (ratio_profit < 0.1 && ratio_profit > 0.05) {
      return 0.03;
    }
    return 0.04;
  }

  public calculatePStop = ({ p_open, p_claim }: TCalPStop): number => {
    const ratio_profit = this.calculateRatioPredict({ p_open, p_claim });
    const future_diff_stop = this.getDiffStop(ratio_profit);
    let p_stop: number;

    if (Big(p_claim).gt(p_open)) {
      p_stop = Big(p_open)
        .minus(Big(p_open).times(Big(ratio_profit).plus(future_diff_stop)))
        .toNumber();
    } else {
      p_stop = Big(p_open)
        .plus(Big(p_open).times(Big(ratio_profit).plus(future_diff_stop)))
        .toNumber();
    }
    return p_stop;
  };

  public calculateLeverage(ratio_profit: number) {
    const future_diff_stop = this.getDiffStop(ratio_profit);
    const percent_p_expired = Big(ratio_profit).plus(future_diff_stop).toNumber();
    return Math.floor(1 / percent_p_expired);
  }

  public calculateQClaim({ margin, p_open, p_claim, hedge, day_change_token, period_unit }: TCalQClaim) {
    const p_stop = this.calculatePStop({ p_open, p_claim, hedge });
    const ratio_profit = this.calculateRatioPredict({
      p_claim,
      p_open,
    });
    const user_capital = margin;
    const system_capital = this.calculateSystemCapital({
      margin,
      p_stop,
      p_open,
      day_change_token,
      ratio_profit,
    });
    const hedge_capital = Big(user_capital).add(system_capital).toNumber();
    const leverage = this.calculateLeverage(ratio_profit);
    const profit = Big(ratio_profit).times(hedge_capital).times(leverage).toNumber();
    const ratio = (period_unit === PERIOD_UNIT.HOUR ? CONFIG.Q_CLAIM_CONFIG_HOUR : CONFIG.Q_CLAIM_CONFIG_DAY).reduce(
      (prev, curr) => {
        const currHedge = Big(curr.hedge).minus(hedge).abs();
        const prevHedge = Big(prev.hedge).minus(hedge).abs();
        return Big(currHedge).lt(prevHedge) ? curr : prev;
      },
    );
    const q_claim = Big(profit)
      .times(Big(1).minus(this.diff_claim))
      .times(Big(1).minus(ratio.x))
      .plus(margin)
      .toNumber();

    return q_claim;
  }

  public calculatePRefund(p_open: number, p_claim: number) {
    const isBull = Big(p_claim).gt(p_open);
    return Number(Big(p_open).times(isBull ? 1 + this.refund_ratio : 1 - this.refund_ratio));
  }

  public calculateHedge(number1: number, number2: number) {
    return Big(number1).div(number2).toNumber();
  }

  public calculateQuantityFuture({ p_open, p_claim, hedge, margin, day_change_token }: TCalQuantityFuture) {
    const p_stop = this.calculatePStop({ p_open, p_claim, hedge });
    const leverage = Math.floor(p_open / Math.abs(p_open - p_stop));
    const user_capital = margin;
    const ratio_profit = Big(p_claim).minus(p_open).abs().div(p_open).toNumber();
    const system_capital = this.calculateSystemCapital({
      margin,
      p_stop,
      p_open,
      day_change_token,
      ratio_profit,
    });
    const hedge_capital = Big(user_capital).plus(system_capital);
    const qty = hedge_capital.times(leverage).div(p_open).toNumber();
    return qty;
  }

  public calculateExpired(params: TCalExpired): number {
    const { period, period_unit } = params;
    let expired: number;
    switch (period_unit) {
      case PERIOD_UNIT.DAY:
        expired = new Date(
          new Date().getTime() + parseInt(period as unknown as string) * 60 * 60 * 1000 * 24,
        ).getTime();
        break;
      case PERIOD_UNIT.HOUR:
        expired = new Date(new Date().getTime() + parseInt(period as unknown as string) * 60 * 60 * 1000).getTime();
        break;
    }
    return expired;
  }

  public formatDecimalUsdt(amount: number) {
    return Big(amount).toFixed(this.decimal_usdt); // decimal usdt = 2
  }

  public getAvailablePeriod(hedge: number, list_ratio_change: Array<TListRatioChange>) {
    list_ratio_change = list_ratio_change.sort((a, b) => {
      return a?.periodChangeRatio - b?.periodChangeRatio;
    });

    const result = [];
    const max = Math.min(list_ratio_change.length, this.max_period);
    if (max > 0) {
      result.push(list_ratio_change[0]);

      for (let i = 1; i < max; i++) {
        const diff_previous = Big(list_ratio_change[i - 1].periodChangeRatio)
          .minus(hedge)
          .abs();
        const diff_current = Big(list_ratio_change[i].periodChangeRatio).minus(hedge).abs();
        if (diff_previous.gte(diff_current)) {
          result.push(list_ratio_change[i]);
        } else {
          break;
        }
      }
    }

    return result;
  }

  public getDistancePClaim(params: TGetDistancePClaim) {
    const { p_market, list_ratio_change, side, signal } = params;
    const sort_list_avg = list_ratio_change.map(item => {
      return item.periodChangeRatio
    }).sort();
    //Filter list avg remove ratio >= 1
    const filter_sort_list_avg = sort_list_avg.filter((v) => v < 1);

    let claim_price_min = 0, claim_price_max = 0;
    if (signal === ENUM_SYMBOL_PREDICTION.BUY) {
      if (side === ENUM_INSURANCE_SIDE.BULL) {
        claim_price_min = Big(this.constant_claim).plus(this.filterRatioDifferentPriceClaim(sort_list_avg[0], 0.5)).times(p_market).toNumber();
        claim_price_max = Big(this.constant_claim).plus(this.filterRatioDifferentPriceClaim(sort_list_avg[sort_list_avg.length - 1], 0.5)).times(p_market).toNumber();
      } else if (side === ENUM_INSURANCE_SIDE.BEAR) {
        //Can check so max < 1
        claim_price_min = Big(this.constant_claim).minus(this.filterRatioDifferentPriceClaim(filter_sort_list_avg[filter_sort_list_avg.length - 1], 0.9)).times(p_market).toNumber();
        claim_price_max = Big(this.constant_claim).minus(this.filterRatioDifferentPriceClaim(sort_list_avg[0], 0.9)).times(p_market).toNumber();
      }
    } else if (signal === ENUM_SYMBOL_PREDICTION.SELL) {
      if (side === ENUM_INSURANCE_SIDE.BULL) {
        claim_price_min = Big(this.constant_claim).plus(this.filterRatioDifferentPriceClaim(sort_list_avg[0], 0.9)).times(p_market).toNumber();
        claim_price_max = Big(this.constant_claim).plus(this.filterRatioDifferentPriceClaim(sort_list_avg[sort_list_avg.length - 1], 0.9)).times(p_market).toNumber();
      } else if (side === ENUM_INSURANCE_SIDE.BEAR) {
        //Can check so max < 1
        claim_price_min = Big(this.constant_claim).minus(this.filterRatioDifferentPriceClaim(filter_sort_list_avg[filter_sort_list_avg.length - 1], 0.5)).times(p_market).toNumber();
        claim_price_max = Big(this.constant_claim).minus(this.filterRatioDifferentPriceClaim(sort_list_avg[0], 0.5)).times(p_market).toNumber();
      }
    } else {
      if (side === ENUM_INSURANCE_SIDE.BULL) {
        claim_price_min = Big(this.constant_claim).plus(this.filterRatioDifferentPriceClaim(sort_list_avg[0])).times(p_market).toNumber();
        claim_price_max = Big(this.constant_claim).plus(this.filterRatioDifferentPriceClaim(sort_list_avg[sort_list_avg.length - 1])).times(p_market).toNumber();
      } else if (side === ENUM_INSURANCE_SIDE.BEAR) {
        //Can check so max < 1
        claim_price_min = Big(this.constant_claim).minus(this.filterRatioDifferentPriceClaim(filter_sort_list_avg[filter_sort_list_avg.length - 1])).times(p_market).toNumber();
        claim_price_max = Big(this.constant_claim).minus(this.filterRatioDifferentPriceClaim(sort_list_avg[0])).times(p_market).toNumber();
      }
    }

    return { claim_price_min, claim_price_max };
  }

  private filterRatioDifferentPriceClaim(avg_change: number, time = 1) {
    const calc = Big(avg_change).times(time);
    return Big(this.ratio_different_price_claim).gt(calc) ? this.ratio_different_price_claim : calc;
  }

  public getMinAvg(list_avg: Array<number>): number {
    const max = Math.min(list_avg.length, this.max_period);
    let min_avg = 0;
    for (let i = 1; i < max; i++) {
      if (list_avg[i] > this.constant_claim) {
        min_avg = list_avg[i - 1];
        break;
      } else {
        min_avg = list_avg[i];
      }
    }

    return min_avg;
  }
}
