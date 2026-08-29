package com.margins.contact.mapper;

import com.margins.contact.model.ContactInquiry;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Options;

/** 공개 문의의 최초 저장과 전달 상태 전이를 담당하는 MyBatis mapper다. */
@Mapper
public interface ContactMapper {
    @Insert("""
        INSERT INTO contact_inquiries
          (email,category,subject,message,status,created_at,delete_after,is_test_data)
        VALUES
          (#{email},#{category},#{subject},#{message},#{status},#{createdAt},#{deleteAfter},#{testData})
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ContactInquiry inquiry);

    @Update("""
        UPDATE contact_inquiries
        SET status='OPEN', provider_message_id=#{providerMessageId}, delivery_failure_code=NULL,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=#{id} AND status='PENDING_DELIVERY'
        """)
    int markOpen(@Param("id") Long id, @Param("providerMessageId") String providerMessageId);

    @Update("""
        UPDATE contact_inquiries
        SET status='DELIVERY_FAILED', delivery_failure_code=#{failureCode},
            updated_at=CURRENT_TIMESTAMP
        WHERE id=#{id} AND status='PENDING_DELIVERY'
        """)
    int markDeliveryFailed(@Param("id") Long id, @Param("failureCode") String failureCode);
}
