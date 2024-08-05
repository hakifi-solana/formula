import { ENUM_INSURANCE_SIDE, ENUM_SYMBOL_PREDICTION, InsuranceFormula, PERIOD_UNIT } from '../index';

describe('Valid Formula', () => {
  const insuranceFormula: InsuranceFormula = new InsuranceFormula();

  describe('Test getAvailablePeriod', () => {
    const hedge = 0.1;
    const avgConfig = [
      {
        period: 1,
        periodUnit: "days",
        periodChangeRatio: 0.142
      },
      {
        period: 2,
        periodUnit: "days",
        periodChangeRatio: 0.176
      },
      {
        period: 3,
        periodUnit: "days",
        periodChangeRatio: 0.21
      },
      {
        period: 1,
        periodUnit: "hours",
        periodChangeRatio: 0.04
      },
      {
        period: 4,
        periodUnit: "hours",
        periodChangeRatio: 0.074
      },
      {
        period: 12,
        periodUnit: "hours",
        periodChangeRatio: 0.108
      },
    ];

    test('should match an available period', () => {
      const availablePeriod = insuranceFormula.getAvailablePeriod(hedge, avgConfig);
      console.log('availablePeriod', availablePeriod)

      expect(availablePeriod).toEqual([
        { period: 1, periodUnit: 'hours', periodChangeRatio: 0.04 },
        { period: 4, periodUnit: 'hours', periodChangeRatio: 0.074 },
        { period: 12, periodUnit: "hours", periodChangeRatio: 0.108 },
      ]);
    });
  });

  describe('New Period', () => {
    const hedge = 0.5122;
    const avgConfig = [
      0.04, 0.074, 0.108, 0.142, 0.176, 0.21, 0.244, 0.278, 0.312, 0.346, 0.38, 0.414, 0.448, 0.482, 0.516,
    ];

    const listRatioChange = [
      {
        period: 1,
        periodUnit: "days",
        periodChangeRatio: 0.142
      },
      {
        period: 2,
        periodUnit: "days",
        periodChangeRatio: 0.176
      },
      {
        period: 3,
        periodUnit: "days",
        periodChangeRatio: 0.21
      },
      {
        period: 4,
        periodUnit: "days",
        periodChangeRatio: 0.244
      },
      {
        period: 5,
        periodUnit: "days",
        periodChangeRatio: 0.278
      },
      {
        period: 6,
        periodUnit: "days",
        periodChangeRatio: 0.312
      },
      {
        period: 7,
        periodUnit: "days",
        periodChangeRatio: 0.346
      },
      {
        period: 8,
        periodUnit: "days",
        periodChangeRatio: 0.38
      },
      {
        period: 9,
        periodUnit: "days",
        periodChangeRatio: 0.414
      },
      {
        period: 10,
        periodUnit: "days",
        periodChangeRatio: 0.448
      },
      {
        period: 11,
        periodUnit: "days",
        periodChangeRatio: 0.482
      },
      {
        period: 12,
        periodUnit: "days",
        periodChangeRatio: 0.516
      },
      {
        period: 1,
        periodUnit: "hours",
        periodChangeRatio: 0.04
      },
      {
        period: 4,
        periodUnit: "hours",
        periodChangeRatio: 0.074
      },
      {
        period: 12,
        periodUnit: "hours",
        periodChangeRatio: 0.108
      },
    ];

    test('should match a min avg', () => {
      const minAvg = insuranceFormula.getMinAvg(avgConfig);

      expect(minAvg).toEqual(0.516);
    });

    test('should match a min and max p_claim - BULL', () => {
      const { claim_price_max, claim_price_min } = insuranceFormula.getDistancePClaim({
        p_market: 200,
        list_ratio_change: listRatioChange,
        side: ENUM_INSURANCE_SIDE.BULL,
        signal: ENUM_SYMBOL_PREDICTION.BUY
      });

      expect(claim_price_max).toEqual(251.6);
      expect(claim_price_min).toEqual(206);
    });

    test('should match a min and max p_claim - BEAR', () => {
      const { claim_price_max, claim_price_min } = insuranceFormula.getDistancePClaim({
        p_market: 200,
        list_ratio_change: listRatioChange,
        side: ENUM_INSURANCE_SIDE.BEAR,
        signal: ENUM_SYMBOL_PREDICTION.BUY
      });

      expect(claim_price_max).toEqual(192.8);
      expect(claim_price_min).toEqual(107.12);
    });
  });

  /*// // BEAR INSURANCE
  describe('Valid BEAR Insurance', () => {
    const margin = 5;
    const p_claim = 45000;
    const p_open = 43226.3;
    const period_unit = PERIOD_UNIT.DAY;
    const day_change_token = 0.04;
    const q_covered = 10000;

    test('should match a valid Q-Claim', () => {
      const q_claim = insuranceFormula.calculateQClaim({
        margin,
        day_change_token,
        hedge: 0,
        p_claim,
        p_open,
        period_unit,
      });

      console.log('QCLAIMMM', q_claim);

      expect(q_claim).toEqual(8.828195739641304);
    });

    test('should match a valid P-Stop BEAR', () => {
      const hedge = insuranceFormula.calculateHedge(margin, q_covered);
      const p_stop = insuranceFormula.calculatePStop({ p_open, p_claim, hedge });
      expect(p_stop).toEqual(5.39308);
    });

    test('should match a valid Binance Quantity', () => {
      const hedge = insuranceFormula.calculateHedge(margin, q_covered);
      const quantity = insuranceFormula.calculateQuantityFuture({
        p_claim,
        p_open,
        hedge,
        margin,
        day_change_token,
      });

      expect(quantity).toEqual(8.809191515157366);
    });
  });

  // // BULL INSURANCE
  describe('Valid BULL Insurance', () => {
    const margin = 0.25;
    const q_covered = 5;
    const p_claim = 0.17066;
    const p_open = 0.16365;
    const period_unit = PERIOD_UNIT.DAY;
    const day_change_token = 0.14484;

    let p_stop: number;

    test('should match a valid Q-Claim', () => {
      const hedge = insuranceFormula.calculateHedge(margin, q_covered);

      const q_claim = insuranceFormula.calculateQClaim({
        margin,
        day_change_token,
        hedge,
        p_claim,
        p_open,
        period_unit,
      });
      expect(q_claim).toEqual(0.3781734100876839);
    });

    test('should match a valid P-Stop', () => {
      const hedge = insuranceFormula.calculateHedge(margin, q_covered);
      p_stop = insuranceFormula.calculatePStop({ p_open, p_claim, hedge });
      expect(p_stop).toEqual(0.153367);
    });

    test('should match a valid Binance Quantity', () => {
      const hedge = insuranceFormula.calculateHedge(margin, q_covered);
      const quantity = insuranceFormula.calculateQuantityFuture({
        p_claim,
        p_open,
        hedge,
        margin,
        day_change_token,
      });

      expect(quantity).toEqual(26.371682641765315);
    });
  });*/
});
