import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RideRoom } from '../schemas/ride-room.schema';
import { RideHistory } from '../schemas/ride-history.schema';
import { RidesService } from './rides.service';

describe('RidesService', () => {
  let service: RidesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RidesService,
        {
          provide: getModelToken(RideRoom.name),
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            deleteOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(RideHistory.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RidesService>(RidesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
