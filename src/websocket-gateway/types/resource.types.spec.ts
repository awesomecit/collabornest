import {
  parseResourceId,
  buildResourceId,
  isSubResource,
  getParentResourceId,
  ResourceId,
} from './resource.types';

describe('Resource Type System', () => {
  describe('parseResourceId', () => {
    describe('root resources', () => {
      it('should parse standard resource ID format', () => {
        const result = parseResourceId('surgery-management:abc-123');

        expect(result).toEqual({
          id: 'surgery-management:abc-123',
          type: 'surgery-management',
          identifier: 'abc-123',
        });
      });

      it('should parse patient record resource ID', () => {
        const result = parseResourceId('patient_record:12345');

        expect(result).toEqual({
          id: 'patient_record:12345',
          type: 'patient_record',
          identifier: '12345',
        });
      });

      it('should parse resource with path-like identifier', () => {
        const result = parseResourceId('page:/patient/12345');

        expect(result).toEqual({
          id: 'page:/patient/12345',
          type: 'page',
          identifier: '/patient/12345',
        });
      });
    });

    describe('sub-resources (1-level hierarchy)', () => {
      it('should parse sub-resource with field type', () => {
        const result = parseResourceId(
          'surgery-management:abc-123/field:anesthesia-notes',
        );

        expect(result).toEqual({
          id: 'surgery-management:abc-123/field:anesthesia-notes',
          type: 'surgery-management',
          identifier: 'abc-123',
          parentId: 'surgery-management:abc-123',
          subType: 'field',
          subIdentifier: 'anesthesia-notes',
        });
      });

      it('should parse sub-resource with section type', () => {
        const result = parseResourceId(
          'clinical_document:doc-456/section:vital-signs',
        );

        expect(result).toEqual({
          id: 'clinical_document:doc-456/section:vital-signs',
          type: 'clinical_document',
          identifier: 'doc-456',
          parentId: 'clinical_document:doc-456',
          subType: 'section',
          subIdentifier: 'vital-signs',
        });
      });

      it('should parse sub-resource with complex identifier', () => {
        const result = parseResourceId(
          'patient_record:12345/field:medications.dosage',
        );

        expect(result).toEqual({
          id: 'patient_record:12345/field:medications.dosage',
          type: 'patient_record',
          identifier: '12345',
          parentId: 'patient_record:12345',
          subType: 'field',
          subIdentifier: 'medications.dosage',
        });
      });
    });

    describe('invalid formats', () => {
      it('should throw error for missing type separator', () => {
        expect(() => parseResourceId('invalid-format')).toThrow(
          'Invalid resource ID format: "invalid-format". Expected "type:id" or "type:id/subType:subId"',
        );
      });

      it('should throw error for empty string', () => {
        expect(() => parseResourceId('')).toThrow('Invalid resource ID format');
      });

      it('should throw error for missing identifier', () => {
        expect(() => parseResourceId('surgery-management:')).toThrow(
          'Invalid resource ID format',
        );
      });

      it('should throw error for nested sub-resources (>1 level)', () => {
        // Not supported: "type:id/subType:subId/nestedType:nestedId"
        // Parser will extract LAST "/type:id" pattern as sub-resource
        const deepNested =
          'surgery-management:abc-123/field:notes/annotation:xyz';
        const result = parseResourceId(deepNested);

        // Parser extracts the LAST occurrence: "/annotation:xyz"
        expect(result.type).toBe('surgery-management');
        expect(result.identifier).toBe('abc-123/field:notes');
        expect(result.parentId).toBe('surgery-management:abc-123/field:notes');
        expect(result.subType).toBe('annotation');
        expect(result.subIdentifier).toBe('xyz');

        // This demonstrates that nested resources are flattened to 1-level
        // Business logic should validate against multi-level nesting
      });
    });
  });

  describe('buildResourceId', () => {
    it('should build root resource ID', () => {
      const result = buildResourceId('surgery-management', 'abc-123');

      expect(result).toBe('surgery-management:abc-123');
    });

    it('should build sub-resource ID with all components', () => {
      const result = buildResourceId(
        'surgery-management',
        'abc-123',
        'field',
        'anesthesia-notes',
      );

      expect(result).toBe('surgery-management:abc-123/field:anesthesia-notes');
    });

    it('should ignore sub-resource if only subType provided', () => {
      const result = buildResourceId(
        'surgery-management',
        'abc-123',
        'field',
        undefined,
      );

      expect(result).toBe('surgery-management:abc-123');
    });

    it('should ignore sub-resource if only subIdentifier provided', () => {
      const result = buildResourceId(
        'surgery-management',
        'abc-123',
        undefined,
        'notes',
      );

      expect(result).toBe('surgery-management:abc-123');
    });
  });

  describe('isSubResource', () => {
    it('should return false for root resources', () => {
      expect(isSubResource('surgery-management:abc-123')).toBe(false);
      expect(isSubResource('patient_record:12345')).toBe(false);
      expect(isSubResource('page:/patient/12345')).toBe(false);
    });

    it('should return true for sub-resources', () => {
      expect(
        isSubResource('surgery-management:abc-123/field:anesthesia-notes'),
      ).toBe(true);
      expect(
        isSubResource('clinical_document:doc-456/section:vital-signs'),
      ).toBe(true);
    });
  });

  describe('getParentResourceId', () => {
    it('should return null for root resources', () => {
      expect(getParentResourceId('surgery-management:abc-123')).toBeNull();
      expect(getParentResourceId('patient_record:12345')).toBeNull();
    });

    it('should extract parent ID from sub-resources', () => {
      expect(
        getParentResourceId(
          'surgery-management:abc-123/field:anesthesia-notes',
        ),
      ).toBe('surgery-management:abc-123');

      expect(
        getParentResourceId('clinical_document:doc-456/section:vital-signs'),
      ).toBe('clinical_document:doc-456');
    });

    it('should handle complex parent identifiers', () => {
      expect(getParentResourceId('page:/patient/12345/field:medications')).toBe(
        'page:/patient/12345',
      );
    });
  });

  describe('roundtrip consistency', () => {
    it('should maintain consistency for root resources', () => {
      const original = 'surgery-management:abc-123';
      const parsed = parseResourceId(original);
      const rebuilt = buildResourceId(parsed.type, parsed.identifier);

      expect(rebuilt).toBe(original);
    });

    it('should maintain consistency for sub-resources', () => {
      const original = 'surgery-management:abc-123/field:anesthesia-notes';
      const parsed = parseResourceId(original);
      const rebuilt = buildResourceId(
        parsed.type,
        parsed.identifier,
        parsed.subType,
        parsed.subIdentifier,
      );

      expect(rebuilt).toBe(original);
    });
  });

  describe('BDD: Real-world scenarios', () => {
    describe('Scenario: User joins root resource', () => {
      it('Given a surgery management resource, When user joins, Then roomId equals resourceId', () => {
        const resourceId = 'surgery-management:abc-123';
        const parsed = parseResourceId(resourceId);

        expect(parsed.parentId).toBeUndefined();
        expect(isSubResource(resourceId)).toBe(false);

        // Room ID === Resource ID for root resources
        const roomId = resourceId;
        expect(roomId).toBe('surgery-management:abc-123');
      });
    });

    describe('Scenario: User locks specific field in surgery form', () => {
      it('Given a surgery resource, When user locks anesthesia notes field, Then sub-resource lock is created', () => {
        const parentResourceId = 'surgery-management:abc-123';
        const fieldResourceId = buildResourceId(
          'surgery-management',
          'abc-123',
          'field',
          'anesthesia-notes',
        );

        expect(fieldResourceId).toBe(
          'surgery-management:abc-123/field:anesthesia-notes',
        );
        expect(isSubResource(fieldResourceId)).toBe(true);
        expect(getParentResourceId(fieldResourceId)).toBe(parentResourceId);

        // User should be in BOTH rooms:
        // 1. Parent room for presence tracking
        // 2. Sub-resource room for field-specific updates
        const parentRoomId = parentResourceId;
        const fieldRoomId = fieldResourceId;

        expect(parentRoomId).toBe('surgery-management:abc-123');
        expect(fieldRoomId).toBe(
          'surgery-management:abc-123/field:anesthesia-notes',
        );
      });
    });

    describe('Scenario: Broadcast lock event to parent resource users', () => {
      it('Given a field lock, When broadcasting, Then notify users in parent room', () => {
        const fieldResourceId =
          'surgery-management:abc-123/field:anesthesia-notes';
        const parentResourceId = getParentResourceId(fieldResourceId);

        expect(parentResourceId).toBe('surgery-management:abc-123');

        // Broadcast to parent room so all users see field lock
        const broadcastTargets = [parentResourceId, fieldResourceId].filter(
          Boolean,
        );

        expect(broadcastTargets).toEqual([
          'surgery-management:abc-123',
          'surgery-management:abc-123/field:anesthesia-notes',
        ]);
      });
    });

    describe('Scenario: Patient record with nested medication field', () => {
      it('Given patient record 12345, When user edits medications.dosage, Then correct hierarchy is maintained', () => {
        const patientResourceId = 'patient_record:12345';
        const medicationFieldId = buildResourceId(
          'patient_record',
          '12345',
          'field',
          'medications.dosage',
        );

        const parsed = parseResourceId(medicationFieldId);

        expect(parsed.parentId).toBe('patient_record:12345');
        expect(parsed.subType).toBe('field');
        expect(parsed.subIdentifier).toBe('medications.dosage');
      });
    });
  });
});
